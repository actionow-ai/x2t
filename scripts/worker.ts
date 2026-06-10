import { writeFileSync } from "node:fs";
import { ingestAll } from "../src/lib/ingest";
import { analyzePending } from "../src/lib/agent";
import { runDigest } from "../src/lib/digest";
import { backfillPrices } from "../src/lib/prices";
import { BENCHMARK_SYMBOL } from "../src/lib/stance";
import { prisma } from "../src/lib/db";
import { HEARTBEAT_FILE } from "../src/lib/health";
import { startJob, finishJob, ranSuccessfullyToday } from "../src/lib/jobrun";
import { nasdaqEnabled, buildNasdaqEarningsMap } from "../src/lib/marketdata/nasdaq";

// 加载 .env（独立进程；DB / LLM / 行情 / VAPID key 都从这里来）
try {
  process.loadEnvFile();
} catch {
  /* ignore */
}

// 生产常驻 Worker —— 一个进程跑完整后台管道：
//   每轮 POLL_INTERVAL_MS：抓取所有 active 源 → 立刻消费 pending 帖（分析）。
//   可选每日摘要（WORKER_RUN_DIGEST=true 时由本进程跑；否则用独立 `pnpm digest` cron）。
//   所有任务结果写 JobRun 表(团队约定"写 DB 观测"),digest 调度据 JobRun 持久化,重启不丢。
//
//   pnpm worker          常驻循环（容器/PM2 入口）
//   pnpm worker --once   跑一轮退出（适合外部 cron 调度）
const once = process.argv.includes("--once");
const POLL_MS = Number(process.env.POLL_INTERVAL_MS ?? 180_000);
const ANALYZE_BATCH = Number(process.env.ANALYZE_BATCH ?? 20);
const RUN_DIGEST = process.env.WORKER_RUN_DIGEST === "true";
const DIGEST_HOUR = Number(process.env.DIGEST_HOUR_UTC ?? 13); // 每天 UTC 此小时后首个 tick 发摘要(默认美东早晨)

let stopping = false;
let lastGc = 0; // 启动即先 GC 一次过期缓存
const GC_MS = Number(process.env.CACHE_GC_INTERVAL_MS ?? 3_600_000);
let lastPrice = 0; // 启动即先回填一次价格
const PRICE_MS = Number(process.env.PRICE_BACKFILL_INTERVAL_MS ?? 86_400_000); // 默认每天
let lastNasdaq = 0; // Nasdaq 财报 map 每日构建一次
const NASDAQ_MS = 24 * 3_600_000;

async function tick() {
  const start = Date.now();
  const jobId = await startJob("tick");
  let stats: Record<string, number> = {};
  try {
    const ing = await ingestAll();
    // 抓完立刻清空 pending（可能多批），上限 10 批防失控
    let processed = 0,
      ok = 0;
    for (let round = 0; round < 10; round++) {
      const r = await analyzePending(ANALYZE_BATCH);
      processed += r.processed;
      ok += r.ok;
      if (r.processed < ANALYZE_BATCH) break;
    }
    stats = { influencers: ing.influencers, created: ing.created, analyzed: processed, analyzedOk: ok };
    console.log(`[worker] tick：源 ${ing.influencers}/新增 ${ing.created}，分析 ${processed}/成功 ${ok}，${Date.now() - start}ms`);
    await finishJob(jobId, true, stats);
  } catch (e) {
    await finishJob(jobId, false, stats, e instanceof Error ? e.message : String(e));
    console.error("[worker] tick 异常:", e instanceof Error ? e.message : e);
  }

  // Nasdaq 财报日历 map 每日构建(免费事件源;仅 EVENTS_NASDAQ=1 时)
  if (nasdaqEnabled() && Date.now() - lastNasdaq >= NASDAQ_MS) {
    try {
      const n = await buildNasdaqEarningsMap();
      lastNasdaq = Date.now();
      console.log(`[worker] Nasdaq 财报 map:${n} 个标的`);
    } catch (e) {
      console.error("[worker] Nasdaq map 构建异常:", e instanceof Error ? e.message : e);
    }
  }

  // 写心跳(同容器 /tmp,供 /api/health 判活)
  try {
    writeFileSync(HEARTBEAT_FILE, String(Date.now()));
  } catch {
    /* ignore */
  }

  // 每日价格回填(复权日线 → PriceDaily,供博主历史胜率回算;节流默认每天)
  if (Date.now() - lastPrice >= PRICE_MS) {
    const jobId = await startJob("backfill");
    try {
      // distinct symbol 按符号序确定性取(DISTINCT ON,无随机截断);上限可调,现实标的数远小于此 → 全覆盖。
      const syms = (
        await prisma.postTicker.findMany({ select: { symbol: true }, distinct: ["symbol"], orderBy: { symbol: "asc" }, take: Number(process.env.PRICE_BACKFILL_MAX ?? 3000) })
      ).map((r) => r.symbol);
      const r = await backfillPrices([BENCHMARK_SYMBOL, ...syms]); // SPY 基准始终回填
      lastPrice = Date.now();
      console.log(`[worker] 价格回填：${r.symbols} 标的 / ${r.rows} 行${r.failed.length ? ` / 失败 ${r.failed.length}` : ""}`);
      await finishJob(jobId, true, { symbols: r.symbols, rows: r.rows, failed: r.failed.length, failedSymbols: r.failed.slice(0, 50) });
    } catch (e) {
      await finishJob(jobId, false, undefined, e instanceof Error ? e.message : String(e));
      console.error("[worker] 价格回填异常:", e instanceof Error ? e.message : e);
    }
  }

  // 过期外部数据缓存 GC(节流,默认每小时一次)
  if (Date.now() - lastGc >= GC_MS) {
    try {
      const del = await prisma.externalDataCache.deleteMany({ where: { expiresAt: { lt: new Date() } } });
      lastGc = Date.now();
      if (del.count) console.log(`[worker] GC：清理过期缓存 ${del.count} 条`);
    } catch (e) {
      console.error("[worker] GC 异常:", e instanceof Error ? e.message : e);
    }
  }

  // 每日摘要:持久化调度——UTC DIGEST_HOUR 后、且【今日尚未成功跑过】才发。
  // 替代内存计时器,修"lastDigest=Date.now() 启动归零 → 容器频繁重启则 digest 永不触发"。
  if (RUN_DIGEST && new Date().getUTCHours() >= DIGEST_HOUR && !(await ranSuccessfullyToday("digest"))) {
    const jobId = await startJob("digest");
    try {
      const d = await runDigest();
      await finishJob(jobId, true, d);
      console.log(`[worker] digest：${d.users} 用户 / 尝试 ${d.attempted} / 送达 ${d.sent} / 失败 ${d.failed}`);
    } catch (e) {
      await finishJob(jobId, false, undefined, e instanceof Error ? e.message : String(e));
      console.error("[worker] digest 异常:", e instanceof Error ? e.message : e);
    }
  }
}

async function loop() {
  while (!stopping) {
    await tick();
    if (stopping) break;
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    if (stopping) return;
    console.log(`[worker] 收到 ${sig}，本轮结束后退出…`);
    stopping = true;
  });
}

// 游离异常只记录不退出,让 loop 继续 tick(偶发 reject 不该整批崩)。
// 注:真正卡死/反复失败由 JobRun + /api/health 的"距上次成功多久"暴露,不再依赖看日志。
process.on("unhandledRejection", (r) => console.error("[worker] unhandledRejection:", r instanceof Error ? r.message : r));
process.on("uncaughtException", (e) => console.error("[worker] uncaughtException:", e instanceof Error ? e.message : e));

async function main() {
  if (once) {
    await tick();
    process.exit(0);
  }
  console.log(`[worker] 启动：poll=${POLL_MS}ms batch=${ANALYZE_BATCH} digest=${RUN_DIGEST ? `每日 UTC${DIGEST_HOUR}:00 后` : "off(独立 cron)"}`);
  await loop();
  console.log("[worker] 已退出");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
