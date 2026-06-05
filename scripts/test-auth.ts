import { prisma } from "../src/lib/db";
import { createMagicLink, consumeMagicLink } from "../src/lib/magic-link";
import { runDigest } from "../src/lib/digest";

try {
  process.loadEnvFile();
} catch {
  /* ignore */
}

// 离线验证 M5：magic-link 单次使用 + follows 增删 + 邮件摘要。
async function main() {
  const email = "authtest@x2t.local";

  const { token, userId } = await createMagicLink(email);
  const consumed = await consumeMagicLink(token);
  const reuse = await consumeMagicLink(token); // 已用 → 应为 null

  const inf = await prisma.influencer.findFirst({ where: { handle: "marketpulse-demo" } });
  if (!inf) throw new Error("缺少种子博主 marketpulse-demo");
  await prisma.follow.create({ data: { userId, influencerId: inf.id } });
  const f1 = await prisma.follow.count({ where: { userId } });

  const dig = await runDigest(); // 该用户关注 marketpulse-demo（有近期 demo 帖）→ 应 ≥1 封

  await prisma.follow.delete({ where: { userId_influencerId: { userId, influencerId: inf.id } } });
  const f2 = await prisma.follow.count({ where: { userId } });

  await prisma.magicLink.deleteMany({ where: { email } });
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});

  console.log(`magic-link: consumed=${consumed === userId} reuse-null=${reuse === null}`);
  console.log(`follow: create=${f1} delete=${f2}`);
  console.log(`digest: users=${dig.users} sent=${dig.sent}`);

  const ok = consumed === userId && reuse === null && f1 === 1 && f2 === 0 && dig.sent >= 1;
  console.log(ok ? "✅ M5 鉴权 + 关注 + 摘要 逻辑正确" : "❌ 不符合预期");
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
