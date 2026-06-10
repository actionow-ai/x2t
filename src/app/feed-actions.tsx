"use server";

import type { ReactNode } from "react";
import { PostCard } from "@/components/PostCard";
import { prisma } from "@/lib/db";
import { getMyVotes } from "@/lib/reactions";
import { getLocale } from "@/lib/i18n-server";
import { resolveFollowedIds, feedWhere, fetchFeedRows, searchPostsWhere, FEED_PAGE, FEED_SELECT, type StanceFilter } from "@/lib/feed";

type FeedRow = Awaited<ReturnType<typeof fetchFeedRows>>[number];
type LoadResult = { nodes: ReactNode; nextCursor: number | null };

// 把一页(postedAt 为 ms)渲染成 PostCard 片段 + 算游标。供信息流 / 博主页「加载更多」复用。
async function renderFeed(rows: FeedRow[]): Promise<LoadResult> {
  const locale = await getLocale();
  const myVotes = await getMyVotes(rows.map((p) => p.id));
  const nodes = (
    <>
      {rows.map((p) => (
        <PostCard key={p.id} post={{ ...p, postedAt: new Date(p.postedAt), myVote: myVotes[p.id] ?? 0 }} locale={locale} />
      ))}
    </>
  );
  const nextCursor = rows.length === FEED_PAGE ? rows[rows.length - 1].postedAt : null;
  return { nodes, nextCursor };
}

// 信息流「加载更多」(ctx 由 page.tsx .bind 绑入):view=following 按当前用户已关注过滤;sig=0 看全部。
export async function loadMoreFeed(ctx: { view: string; sig: string }, beforeMs: number): Promise<LoadResult> {
  const onlySignal = ctx.sig !== "0";
  const followIds = ctx.view === "following" ? await resolveFollowedIds() : null;
  return renderFeed(await fetchFeedRows(feedWhere(followIds, onlySignal, beforeMs)));
}

// 博主页「加载更多」(influencerId 由 /i .bind 绑入)。
export async function loadMoreInfluencerPosts(influencerId: string, beforeMs: number): Promise<LoadResult> {
  const rows = await prisma.post.findMany({
    where: { influencerId, postedAt: { lt: new Date(beforeMs) } },
    orderBy: { postedAt: "desc" },
    take: FEED_PAGE,
    select: FEED_SELECT,
  });
  return renderFeed(rows.map((p) => ({ ...p, postedAt: p.postedAt.getTime() })));
}

// 搜索结果「加载更多」(q/stance 由 /search .bind 绑入)。
export async function loadMoreSearch(ctx: { q: string; stance: StanceFilter }, beforeMs: number): Promise<LoadResult> {
  return renderFeed(await fetchFeedRows(searchPostsWhere(ctx.q, ctx.stance, beforeMs)));
}
