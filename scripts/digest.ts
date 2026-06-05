import { runDigest } from "../src/lib/digest";

try {
  process.loadEnvFile();
} catch {
  /* ignore */
}

// 邮件摘要 Worker（建议每日 cron 跑一次）。未配 SMTP 时摘要打到控制台。
async function main() {
  const r = await runDigest();
  console.log(`[digest] 处理 ${r.users} 用户，发送 ${r.sent} 封摘要`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
