import webpush from "web-push";
import { prisma } from "./db";
import { getVapid } from "./vapid";

let configured = false;
function configure(): boolean {
  if (configured) return true;
  const v = getVapid();
  if (!v) return false;
  webpush.setVapidDetails(v.subject, v.publicKey, v.privateKey);
  configured = true;
  return true;
}

export type PushSubInput = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  followFilter: string[]; // 关注的 influencer id 列表
  userId?: string | null;
};

/** 保存/更新一个 web-push 订阅（按 endpoint 幂等）。匿名也可订阅（userId 可空）。 */
export async function savePushSubscription(input: PushSubInput) {
  return prisma.pushSubscription.upsert({
    where: { endpoint: input.endpoint },
    create: {
      endpoint: input.endpoint,
      keysJson: input.keys,
      followFilter: input.followFilter,
      userId: input.userId ?? null,
    },
    update: { keysJson: input.keys, followFilter: input.followFilter },
  });
}

/**
 * 「新帖」事件：把一条新帖推给所有 followFilter 包含该博主的订阅。
 * - deliveries 去重：同一 (post × 订阅 × 渠道) 不重复推
 * - 端点过期(404/410) → 清理订阅
 * - VAPID 未配置 → 静默跳过（不阻塞抓取）
 */
export async function notifyNewPost(postId: string): Promise<{ targeted: number; sent: number; skipped?: string }> {
  if (!configure()) return { targeted: 0, sent: 0, skipped: "no-vapid" };

  const post = await prisma.post.findUnique({ where: { id: postId }, include: { influencer: true } });
  if (!post) return { targeted: 0, sent: 0 };

  const subs = await prisma.pushSubscription.findMany({
    where: { followFilter: { array_contains: post.influencerId } },
  });

  const name = post.influencer.displayName ?? post.influencer.handle;
  const payload = JSON.stringify({
    title: `${name} 发新帖`,
    body: post.contentText.slice(0, 120),
    url: `/p/${post.id}`,
  });

  let sent = 0;
  for (const sub of subs) {
    const already = await prisma.delivery.findUnique({
      where: {
        postId_pushSubscriptionId_channel: { postId: post.id, pushSubscriptionId: sub.id, channel: "webpush" },
      },
    });
    if (already) continue;

    const keys = sub.keysJson as { p256dh: string; auth: string };
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys }, payload);
      await prisma.delivery.create({
        data: { postId: post.id, pushSubscriptionId: sub.id, channel: "webpush", status: "sent" },
      });
      sent++;
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
      } else {
        await prisma.delivery
          .create({ data: { postId: post.id, pushSubscriptionId: sub.id, channel: "webpush", status: "failed" } })
          .catch(() => {});
      }
    }
  }

  return { targeted: subs.length, sent };
}
