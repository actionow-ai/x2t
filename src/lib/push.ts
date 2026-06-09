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

  // 一次性查出已投递集合(去重),避免循环内逐 sub findUnique 的 N+1
  const delivered = new Set(
    (
      await prisma.delivery.findMany({
        where: { postId: post.id, channel: "webpush", pushSubscriptionId: { in: subs.map((s) => s.id) } },
        select: { pushSubscriptionId: true },
      })
    ).map((d) => d.pushSubscriptionId),
  );

  let sent = 0;
  for (const sub of subs) {
    if (delivered.has(sub.id)) continue;

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

function stanceZh(s: string): string {
  return s === "bullish" ? "看多" : s === "bearish" ? "看空" : "中性";
}

/**
 * 「立场转向」事件：博主对某票翻多/翻空时，推给关注该博主的订阅。
 * 与「新帖」用不同 delivery 渠道(webpush-flip)，各自去重。
 */
export async function notifyFlip(
  postId: string,
  flips: { symbol: string; prevStance: string; newStance: string }[],
): Promise<{ sent: number }> {
  if (!configure() || flips.length === 0) return { sent: 0 };

  const post = await prisma.post.findUnique({ where: { id: postId }, include: { influencer: true } });
  if (!post) return { sent: 0 };

  const subs = await prisma.pushSubscription.findMany({
    where: { followFilter: { array_contains: post.influencerId } },
  });

  const name = post.influencer.displayName ?? post.influencer.handle;
  const text = flips.map((f) => `$${f.symbol} ${stanceZh(f.prevStance)}→${stanceZh(f.newStance)}`).join("、");
  const payload = JSON.stringify({ title: `⇄ ${name} 立场转向`, body: text, url: `/p/${post.id}` });

  const delivered = new Set(
    (
      await prisma.delivery.findMany({
        where: { postId: post.id, channel: "webpush-flip", pushSubscriptionId: { in: subs.map((s) => s.id) } },
        select: { pushSubscriptionId: true },
      })
    ).map((d) => d.pushSubscriptionId),
  );

  let sent = 0;
  for (const sub of subs) {
    if (delivered.has(sub.id)) continue;

    const keys = sub.keysJson as { p256dh: string; auth: string };
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys }, payload);
      await prisma.delivery.create({
        data: { postId: post.id, pushSubscriptionId: sub.id, channel: "webpush-flip", status: "sent" },
      });
      sent++;
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
      } else {
        await prisma.delivery
          .create({ data: { postId: post.id, pushSubscriptionId: sub.id, channel: "webpush-flip", status: "failed" } })
          .catch(() => {});
      }
    }
  }
  return { sent };
}
