import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { cookies } from "next/headers";
import { getCurrentUserId } from "./auth";

// 信息流取数:首页(缓存首屏)与「加载更多」server action 共用,保证 where/select/分页大小一致。
export const FEED_PAGE = 50;

export const FEED_SELECT = {
  id: true,
  contentText: true,
  contentZh: true,
  contentEn: true,
  url: true,
  postedAt: true,
  influencer: { select: { handle: true, displayName: true, avatarUrl: true } },
  analysis: { select: { summary: true, summaryEn: true, overallStance: true } },
  tickers: { select: { symbol: true, stance: true } },
  likeCount: true,
  dislikeCount: true,
} as const;

// 已关注 ids:登录→DB,匿名→cookie(由 follow-client 镜像)。
export async function resolveFollowedIds(): Promise<string[]> {
  const uid = await getCurrentUserId();
  if (uid) return (await prisma.follow.findMany({ where: { userId: uid }, select: { influencerId: true } })).map((f) => f.influencerId);
  const raw = (await cookies()).get("x2t_follows")?.value ?? "";
  return decodeURIComponent(raw)
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

// feed where:manual 不进公共流;关注过滤;信号优先;beforeMs=游标(取早于该时刻的帖,加载更多)。
export function feedWhere(followIds: string[] | null, onlySignal: boolean, beforeMs?: number) {
  return {
    influencer: { platform: { not: "manual" as const } },
    ...(followIds ? { influencerId: { in: followIds.length ? followIds : ["__none__"] } } : {}),
    ...(onlySignal ? { analysis: { overallStance: { in: ["bullish", "bearish"] as ("bullish" | "bearish")[] } } } : {}),
    ...(beforeMs ? { postedAt: { lt: new Date(beforeMs) } } : {}),
  };
}

// 取一页帖子(postedAt 降序,回传 ms)。feed / 搜索结果共用。
export async function fetchFeedRows(where: Prisma.PostWhereInput) {
  const rows = await prisma.post.findMany({ where, orderBy: { postedAt: "desc" }, take: FEED_PAGE, select: FEED_SELECT });
  return rows.map((p) => ({ ...p, postedAt: p.postedAt.getTime() }));
}

// 帖子全文搜索 where:正文(原文/中/英)子串匹配(大小写不敏感)+ 可选立场过滤 + 游标。
export type StanceFilter = "bullish" | "bearish" | "neutral" | "";
export function searchPostsWhere(q: string, stance: StanceFilter, beforeMs?: number): Prisma.PostWhereInput {
  const like = { contains: q, mode: "insensitive" as const };
  return {
    influencer: { platform: { not: "manual" as const } },
    OR: [{ contentText: like }, { contentZh: like }, { contentEn: like }],
    ...(stance ? { analysis: { overallStance: stance } } : {}),
    ...(beforeMs ? { postedAt: { lt: new Date(beforeMs) } } : {}),
  };
}
