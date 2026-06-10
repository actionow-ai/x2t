import webpush from "web-push";
import { prisma } from "./db";
import { getVapid } from "./vapid";
import { notify, pickLocale, type NotifyLocale } from "./notify-format";

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
  followFilter: string[]; // 关注的 influencer id 列表(匿名镜像;登录用户以 DB Follow 为准)
  userId?: string | null;
};

/** 保存/更新一个 web-push 订阅（按 endpoint 幂等）。匿名也可订阅（userId 可空）。 */
export async function savePushSubscription(input: PushSubInput) {
  return prisma.pushSubscription.upsert({
    where: { endpoint: input.endpoint },
    create: { endpoint: input.endpoint, keysJson: input.keys, followFilter: input.followFilter, userId: input.userId ?? null },
    // 登录后用同 endpoint 再订阅 → 补绑 userId(匿名再订阅不清除已绑定的 userId)
    update: { keysJson: input.keys, followFilter: input.followFilter, ...(input.userId ? { userId: input.userId } : {}) },
  });
}

/** 告警事件:推给某用户自己的所有订阅(规则命中时用)。title/body 由调用方按 user.locale 生成。 */
export async function sendAlertToUser(userId: string, title: string, body: string, url: string): Promise<number> {
  if (!configure()) return 0;
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  if (!subs.length) return 0;
  const payload = JSON.stringify({ title, body, url });
  let sent = 0;
  for (const sub of subs) {
    const keys = sub.keysJson as { p256dh: string; auth: string };
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys }, payload);
      sent++;
    } catch (err: unknown) {
      const sc = (err as { statusCode?: number }).statusCode;
      if (sc === 404 || sc === 410) await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
    }
  }
  return sent;
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
 * 共享投递:把一条 payload 推给所有关注该博主的订阅。
 * 命中两路(修 P0-2 登录用户收不到推送):匿名/镜像订阅按 followFilter 含该博主;
 * 登录订阅按其 user 在 DB Follow 了该博主——以单一真源 DB 为准,不依赖客户端 localStorage 镜像。
 * payload 按每个订阅的 user.locale 个性化(匿名默认 zh);(post×订阅×渠道)去重 + 日上限 + 冷却。
 */
async function deliverToFollowers(
  influencerId: string,
  postId: string,
  channel: string,
  buildPayload: (locale: NotifyLocale) => string,
  dailyCap: number,
): Promise<{ targeted: number; sent: number }> {
  const [byFilter, byFollow] = await Promise.all([
    prisma.pushSubscription.findMany({ where: { followFilter: { array_contains: influencerId } }, include: { user: { select: { locale: true } } } }),
    prisma.pushSubscription.findMany({ where: { user: { is: { follows: { some: { influencerId } } } } }, include: { user: { select: { locale: true } } } }),
  ]);
  const subMap = new Map<string, (typeof byFilter)[number]>();
  for (const s of [...byFilter, ...byFollow]) subMap.set(s.id, s);
  const subs = [...subMap.values()];
  if (!subs.length) return { targeted: 0, sent: 0 };
  const ids = subs.map((s) => s.id);

  const delivered = new Set(
    (await prisma.delivery.findMany({ where: { postId, channel, pushSubscriptionId: { in: ids } }, select: { pushSubscriptionId: true } })).map((d) => d.pushSubscriptionId),
  );

  // 日上限:批量查今日该渠道已发条数(每订阅),达上限的跳过。
  const overCap = new Set<string>();
  if (dailyCap > 0) {
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    const counts = await prisma.delivery.groupBy({
      by: ["pushSubscriptionId"],
      where: { channel, status: "sent", sentAt: { gte: since }, pushSubscriptionId: { in: ids } },
      _count: { _all: true },
    });
    for (const c of counts) if (c.pushSubscriptionId && c._count._all >= dailyCap) overCap.add(c.pushSubscriptionId);
  }

  // 冷却:批量查每订阅最近一次任意推送时间,距今不足 COOLDOWN 的跳过(跨渠道防连环轰炸)。
  const onCooldown = new Set<string>();
  if (COOLDOWN_MS > 0) {
    const last = await prisma.delivery.groupBy({ by: ["pushSubscriptionId"], where: { status: "sent", pushSubscriptionId: { in: ids } }, _max: { sentAt: true } });
    const cutoff = Date.now() - COOLDOWN_MS;
    for (const c of last) if (c.pushSubscriptionId && c._max.sentAt && c._max.sentAt.getTime() > cutoff) onCooldown.add(c.pushSubscriptionId);
  }

  let sent = 0;
  for (const sub of subs) {
    if (delivered.has(sub.id) || overCap.has(sub.id) || onCooldown.has(sub.id)) continue;
    const keys = sub.keysJson as { p256dh: string; auth: string };
    const payload = buildPayload(pickLocale(sub.user?.locale));
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
  return deliverToFollowers(
    post.influencerId,
    post.id,
    "webpush",
    (locale) => JSON.stringify({ title: notify.newPost(locale, name), body: post.contentText.slice(0, 120), url: `/p/${post.id}` }),
    NEWPOST_DAILY_CAP,
  );
}

/** 「立场转向」事件:博主对某票翻多/翻空时推给订阅(渠道 webpush-flip,与新帖各自去重)。 */
export async function notifyFlip(postId: string, flips: { symbol: string; prevStance: string; newStance: string }[]): Promise<{ sent: number }> {
  if (!configure() || flips.length === 0 || inQuietHours()) return { sent: 0 };
  const post = await prisma.post.findUnique({ where: { id: postId }, include: { influencer: true } });
  if (!post) return { sent: 0 };
  const name = post.influencer.displayName ?? post.influencer.handle;
  const { sent } = await deliverToFollowers(
    post.influencerId,
    post.id,
    "webpush-flip",
    (locale) => {
      const text = flips.map((f) => notify.flipLine(locale, f.symbol, f.prevStance, f.newStance)).join(locale === "en" ? ", " : "、");
      return JSON.stringify({ title: notify.flipTitle(locale, name), body: text, url: `/p/${post.id}` });
    },
    FLIP_DAILY_CAP,
  );
  return { sent };
}
