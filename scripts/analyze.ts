import { analyzePending } from "../src/lib/agent";

// 加载 .env（Worker 进程；LLM/数据 provider key 需要）
try {
  process.loadEnvFile();
} catch {
  /* ignore */
}

// Agent 分析 Worker —— 独立进程，消费 analysis_status=pending 的帖子。
//   pnpm analyze:once   处理一批退出
//   pnpm analyze        持续处理
const once = process.argv.includes("--once");
const interval = Number(process.env.ANALYZE_INTERVAL_MS ?? 60_000);

async function runOnce() {
  const start = Date.now();
  try {
    const r = await analyzePending(20);
    console.log(`[analyze] 处理 ${r.processed} 篇，成功 ${r.ok}，用时 ${Date.now() - start}ms`);
  } catch (err) {
    console.error("[analyze] 本轮异常:", err instanceof Error ? err.message : err);
  }
}

async function main() {
  if (once) {
    await runOnce();
    process.exit(0);
  }
  console.log(`[analyze] 持续分析，每 ${interval}ms 一轮。Ctrl+C 退出。`);
  await runOnce();
  setInterval(runOnce, interval);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
