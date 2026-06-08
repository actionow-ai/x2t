import { ingestAll } from "../src/lib/ingest";
import { analyzePending } from "../src/lib/agent";
import { runDigest } from "../src/lib/digest";

// 加载 .env（独立进程；DB / LLM / 行情 / VAPID key 都从这里来）
try {
  process.loadEnvFile();
} catch {
  /* ignore */
}

// 生产常驻 Worker —— 一个进程跑完整后台管道：
//   每轮 POLL_INTERVAL_MS：抓取所有 active 源 → 立刻消费 pending 帖（分析）。
//   可选每日摘要（WORKER_RUN_DIGEST=true 时由本进程跑；否则用独立 `pnpm digest` cron）。
//
//   pnpm worker          常驻循环（容器/PM2 入口）
//   pnpm worker --once   跑一轮退出（适合外部 cron 调度）
const once = process.argv.includes("--once");
const POLL_MS = Number(process.env.POLL_INTERVAL_MS ?? 180_000);
const ANALYZE_BATCH = Number(process.env.ANALYZE_BATCH ?? 20);
const RUN_DIGEST = process.env.WORKER_RUN_DIGEST === "true";
const DIGEST_MS = Number(process.env.DIGEST_INTERVAL_MS ?? 86_400_000);

let stopping = false;
let lastDigest = Date.now(); // 启动后满 DIGEST_MS 才首发，避免每次重启都发

async function tick() {
  const start = Date.now();
  try {
    const ing = await ingestAll();
    // 抓完立刻清空 pending（可能多批），上限 10 批防失控
    let processed = 0, ok = 0;
    for (let round = 0; round < 10; round++) {
      const r = await analyzePending(ANALYZE_BATCH);
      processed += r.processed;
      ok += r.ok;
      if (r.processed < ANALYZE_BATCH) break;
    }
    console.log(
      `[worker] tick：源 ${ing.influencers}/新增 ${ing.created}，分析 ${processed}/成功 ${ok}，${Date.now() - start}ms`,
    );
  } catch (e) {
    console.error("[worker] tick 异常:", e instanceof Error ? e.message : e);
  }

  if (RUN_DIGEST && Date.now() - lastDigest >= DIGEST_MS) {
    try {
      const d = await runDigest();
      lastDigest = Date.now();
      console.log(`[worker] digest：${d.users} 用户/发送 ${d.sent} 封`);
    } catch (e) {
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

async function main() {
  if (once) {
    await tick();
    process.exit(0);
  }
  console.log(`[worker] 启动：poll=${POLL_MS}ms batch=${ANALYZE_BATCH} digest=${RUN_DIGEST ? DIGEST_MS + "ms" : "off(独立 cron)"}`);
  await loop();
  console.log("[worker] 已退出");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
