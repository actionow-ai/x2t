// VAPID 配置 —— web-push 需要。密钥放 .env（用 `pnpm exec web-push generate-vapid-keys` 生成）。
export function getVapid(): { subject: string; publicKey: string; privateKey: string } | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:admin@x2t.local";
  if (!publicKey || !privateKey) return null;
  return { subject, publicKey, privateKey };
}
