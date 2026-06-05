import { prisma } from "../src/lib/db";
import { notifyNewPost } from "../src/lib/push";

try {
  process.loadEnvFile();
} catch {
  /* ignore */
}

// 离线验证「新帖」推送的【目标定位 + 去重】：
// 用一个 followFilter 指向某博主、但 endpoint/keys 是假的订阅——
// sendNotification 会失败（记一条 failed delivery），但目标定位和去重逻辑可验证。
async function main() {
  const inf = await prisma.influencer.findFirst({ where: { handle: "marketpulse-demo" } });
  if (!inf) throw new Error("缺少种子博主 marketpulse-demo");
  const post = await prisma.post.findFirst({ where: { influencerId: inf.id }, orderBy: { postedAt: "desc" } });
  if (!post) throw new Error("该博主没有帖子");

  const endpoint = "https://localhost:1/x2t-test";
  const sub = await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { endpoint, keysJson: { p256dh: "BADKEY", auth: "BADAUTH" }, followFilter: [inf.id] },
    update: { followFilter: [inf.id] },
  });
  console.log(`测试订阅 ${sub.id} 关注 ${inf.handle}，新帖 ${post.id}`);

  const r1 = await notifyNewPost(post.id);
  const d1 = await prisma.delivery.count({ where: { postId: post.id, pushSubscriptionId: sub.id } });
  console.log(`notify #1: targeted=${r1.targeted} sent=${r1.sent} → deliveries=${d1}`);

  const r2 = await notifyNewPost(post.id);
  const d2 = await prisma.delivery.count({ where: { postId: post.id, pushSubscriptionId: sub.id } });
  console.log(`notify #2 (应去重): targeted=${r2.targeted} sent=${r2.sent} → deliveries=${d2}`);

  // 清理
  await prisma.delivery.deleteMany({ where: { pushSubscriptionId: sub.id } });
  await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});

  const ok = r1.targeted >= 1 && d1 === 1 && d2 === 1;
  console.log(ok ? "✅ 目标定位命中 + 去重生效（第二次不重复入 delivery）" : "❌ 不符合预期");
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
