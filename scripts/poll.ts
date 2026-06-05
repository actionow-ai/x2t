import { ingestAll } from "../src/lib/ingest";

// 加载 .env 到 process.env（Worker 进程不像 Next app 那样自动加载；web-push 的 VAPID 需要）
try {
  process.loadEnvFile();
} catch {
  /* .env 不存在时忽略 */
}

// 轮询 Worker —— 设计文档 §4。独立进程，与 web app 同库不同进程。
//   pnpm poll:once   抓一轮退出
//   pnpm poll        按 POLL_INTERVAL_MS 持续轮询
const once = process.argv.includes("--once");
const interval = Number(process.env.POLL_INTERVAL_MS ?? 180_000);

async function runOnce() {
  const start = Date.now();
  try {
    const r = await ingestAll();
    console.log(`[poll] 完成：${r.influencers} 博主，新增 ${r.created} 帖，用时 ${Date.now() - start}ms`);
  } catch (err) {
    console.error("[poll] 本轮异常:", err instanceof Error ? err.message : err);
  }
}

async function main() {
  if (once) {
    await runOnce();
    process.exit(0);
  }

  console.log(`[poll] 持续轮询，每 ${interval}ms 一轮。Ctrl+C 退出。`);
  await runOnce();
  setInterval(runOnce, interval);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
