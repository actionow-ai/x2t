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

// 通知治理(借 PanWatch notify_policy + daily_stock_analysis 的 COOLDOWN/QUIET_HOURS):
// 日上限 + 冷却(两次推送最小间隔)+ 静音时段(UTC)。后两者默认关闭,配 env 才生效。
const NEWPOST_DAILY_CAP = Number(process.env.NEWPOST_DAILY_CAP ?? 12);
const FLIP_DAILY_CAP = Number(process.env.FLIP_DAILY_CAP ?? 6);
const COOLDOWN_MS = Number(process.env.PUSH_COOLDOWN_MINUTES ?? 0) * 60_000;

// 静音时段:env QUIET_HOURS_UTC="22-7"(UTC 22:00–07:59 不推);未配则不静音。
function inQuietHours(): boolean {
  const spec = process.env.QUIET_HOURS_UTC;
  if (!spec) return false;
  const m = spec.match(/^(\d{1,2})-(\d{1,2})$/);
  if (!m) return false;
  const start = Number(m[1]);
  const end = Number(m[2]);
  const h = new Date().getUTCHours();
  return start <= end ? h >= start && h < end : h >= start || h < end; // 支持跨午夜
}

/**
 * 共享投递:把一条 payload 推给所有 followFilter 含该博主的订阅。
 * - 按 (post × 订阅 × 渠道) 去重(一次性查 delivered 集合,避免循环内 N+1)
 * - dailyCap:每订阅每天该渠道达上限则跳过(防刷屏)
 * - 端点过期(404/410) → 清理订阅;其它失败记 failed
 * notifyNewPost / notifyFlip 共用,只是 channel + payload + cap 不同。
 */
async function deliverToFollowers(influencerId: string, postId: string, channel: string, payload: string, dailyCap: number): Promise<{ targeted: number; sent: number }> {
  const subs = await prisma.pushSubscription.findMany({ where: { followFilter: { array_contains: influencerId } } });
  if (!subs.length) return { targeted: 0, sent: 0 };

  const delivered = new Set(
    (
      await prisma.delivery.findMany({
        where: { postId, channel, pushSubscriptionId: { in: subs.map((s) => s.id) } },
        select: { pushSubscriptionId: true },
      })
    ).map((d) => d.pushSubscriptionId),
  );

  // 日上限:批量查今日该渠道已发条数(每订阅),达上限的跳过。
  const overCap = new Set<string>();
  if (dailyCap > 0) {
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    const counts = await prisma.delivery.groupBy({
      by: ["pushSubscriptionId"],
      where: { channel, status: "sent", sentAt: { gte: since }, pushSubscriptionId: { in: subs.map((s) => s.id) } },
      _count: { _all: true },
    });
    for (const c of counts) {
      if (c.pushSubscriptionId && c._count._all >= dailyCap) overCap.add(c.pushSubscriptionId);
    }
  }

  // 冷却:批量查每订阅最近一次任意推送时间,距今不足 COOLDOWN 的跳过(跨渠道防连环轰炸)。
  const onCooldown = new Set<string>();
  if (COOLDOWN_MS > 0) {
    const last = await prisma.delivery.groupBy({
      by: ["pushSubscriptionId"],
      where: { status: "sent", pushSubscriptionId: { in: subs.map((s) => s.id) } },
      _max: { sentAt: true },
    });
    const cutoff = Date.now() - COOLDOWN_MS;
    for (const c of last) {
      if (c.pushSubscriptionId && c._max.sentAt && c._max.sentAt.getTime() > cutoff) onCooldown.add(c.pushSubscriptionId);
    }
  }

  let sent = 0;
  for (const sub of subs) {
    if (delivered.has(sub.id) || overCap.has(sub.id) || onCooldown.has(sub.id)) continue;
    const keys = sub.keysJson as { p256dh: string; auth: string };
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys }, payload);
      await prisma.delivery.create({ data: { postId, pushSubscriptionId: sub.id, channel, status: "sent" } });
      sent++;
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
      } else {
        await prisma.delivery.create({ data: { postId, pushSubscriptionId: sub.id, channel, status: "failed" } }).catch(() => {});
      }
    }
  }
  return { targeted: subs.length, sent };
}

/** 「新帖」事件:推给关注该博主的订阅(渠道 webpush)。VAPID 未配置 → 静默跳过,不阻塞抓取。 */
export async function notifyNewPost(postId: string): Promise<{ targeted: number; sent: number; skipped?: string }> {
  if (!configure()) return { targeted: 0, sent: 0, skipped: "no-vapid" };
  if (inQuietHours()) return { targeted: 0, sent: 0, skipped: "quiet-hours" };
  const post = await prisma.post.findUnique({ where: { id: postId }, include: { influencer: true } });
  if (!post) return { targeted: 0, sent: 0 };

  const name = post.influencer.displayName ?? post.influencer.handle;
  const payload = JSON.stringify({ title: `${name} 发新帖`, body: post.contentText.slice(0, 120), url: `/p/${post.id}` });
  return deliverToFollowers(post.influencerId, post.id, "webpush", payload, NEWPOST_DAILY_CAP);
}

function stanceZh(s: string): string {
  return s === "bullish" ? "看多" : s === "bearish" ? "看空" : "中性";
}

/** 「立场转向」事件:博主对某票翻多/翻空时推给订阅(渠道 webpush-flip,与新帖各自去重)。 */
export async function notifyFlip(
  postId: string,
  flips: { symbol: string; prevStance: string; newStance: string }[],
): Promise<{ sent: number }> {
  if (!configure() || flips.length === 0 || inQuietHours()) return { sent: 0 };
  const post = await prisma.post.findUnique({ where: { id: postId }, include: { influencer: true } });
  if (!post) return { sent: 0 };

  const name = post.influencer.displayName ?? post.influencer.handle;
  const text = flips.map((f) => `$${f.symbol} ${stanceZh(f.prevStance)}→${stanceZh(f.newStance)}`).join("、");
  const payload = JSON.stringify({ title: `⇄ ${name} 立场转向`, body: text, url: `/p/${post.id}` });
  const { sent } = await deliverToFollowers(post.influencerId, post.id, "webpush-flip", payload, FLIP_DAILY_CAP);
  return { sent };
}
