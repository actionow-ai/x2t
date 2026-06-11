import { writeFileSync } from "node:fs";
import { ingestAll } from "../src/lib/ingest";
import { analyzePending } from "../src/lib/agent";
import { runDigest } from "../src/lib/digest";
import { refreshAllBeliefs } from "../src/lib/belief";
import { backfillPrices } from "../src/lib/prices";
import { BENCHMARK_SYMBOL, backfillFlips } from "../src/lib/stance";
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
const ANALYZE_BATCH = Number(process.env.ANALYZE_BATCH ?? 8); // 每 tick 一批的大小(小内存机器默认 8,渐进消化积压;大机器可调高)
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
    // 每个 tick 只处理【一批】(不再一次抽干 pending):把积压摊到多个 tick 渐进消化,
    // 避免在小内存机器上猛冲(大量并发 LLM+行情+DB 写)压垮 K3s/Postgres。
    const r = await analyzePending(ANALYZE_BATCH);
    const processed = r.processed,
      ok = r.ok;
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

  // 过期外部数据缓存 + 旧 Delivery 记录 GC(节流,默认每小时一次)
  if (Date.now() - lastGc >= GC_MS) {
    try {
      const del = await prisma.externalDataCache.deleteMany({ where: { expiresAt: { lt: new Date() } } });
      // Delivery 随推送量单调增长、无清理会拖慢推送治理 groupBy —— 删 30 天前的(去重/冷却只看近期)
      const delDays = Number(process.env.DELIVERY_RETENTION_DAYS ?? 30);
      const delOld = await prisma.delivery.deleteMany({ where: { sentAt: { lt: new Date(Date.now() - delDays * 86_400_000) } } });
      // MagicLink 原本只增不减 → 清过期或已用的(避免表无限增长)
      const delMl = await prisma.magicLink.deleteMany({ where: { OR: [{ expiresAt: { lt: new Date() } }, { usedAt: { not: null } }] } });
      lastGc = Date.now();
      if (del.count || delOld.count || delMl.count) console.log(`[worker] GC：缓存 ${del.count} / 投递 ${delOld.count} / 验证码 ${delMl.count}`);
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

  // 信念回灌:日度刷新博主"历史校准信念"(竞品借鉴:结算→反思→回灌),供 AI 分析 prompt 注入 + 博主页展示。
  if (new Date().getUTCHours() >= DIGEST_HOUR && !(await ranSuccessfullyToday("beliefs"))) {
    const jobId = await startJob("beliefs");
    try {
      const b = await refreshAllBeliefs();
      await finishJob(jobId, true, b);
      console.log(`[worker] beliefs:刷新 ${b.updated} 博主 / 有信念 ${b.withBelief}`);
    } catch (e) {
      await finishJob(jobId, false, undefined, e instanceof Error ? e.message : String(e));
      console.error("[worker] beliefs 异常:", e instanceof Error ? e.message : e);
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

// 启动时确保物化:GIN 索引(jsonb followFilter 不能在 schema 声明)+ Flip 表回填(空则从历史 PostTicker 物化)。
async function ensureMaterialized() {
  try {
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PushSubscription_followFilter_gin" ON "PushSubscription" USING GIN ("followFilter")`);
  } catch (e) {
    console.error("[worker] GIN 索引创建失败:", e instanceof Error ? e.message : e);
  }
  try {
    if ((await prisma.flip.count()) === 0) {
      const n = await backfillFlips();
      console.log(`[worker] Flip 物化回填:${n} 条`);
    }
  } catch (e) {
    console.error("[worker] Flip 回填失败:", e instanceof Error ? e.message : e);
  }
}

async function main() {
  await ensureMaterialized();
  if (once) {
    await tick();
    process.exit(0);
  }
  console.log(`[worker] 启动：poll=${POLL_MS}ms batch=${ANALYZE_BATCH} digest=${RUN_DIGEST ? `每日 UTC${DIGEST_HOUR}:00 后` : "off(独立 cron)"}`);
  // 配置自检:把"忘配即静默降级"的关键开关打出来(mock 用大写醒目),便于发现漏配
  console.log(
    `[worker] 配置:llm=${process.env.LLM_API_KEY ? "real" : "MOCK"} email=${process.env.CF_EMAIL_ACCOUNT_ID ? "cf" : process.env.SMTP_HOST ? "smtp" : "MOCK"} vapid=${process.env.VAPID_PRIVATE_KEY ? "on" : "off"} finnhub=${process.env.FINNHUB_API_KEY ? "on" : "off"} redis=${process.env.REDIS_URL ? "on" : "MEM"}`,
  );
  await loop();
  console.log("[worker] 已退出");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
