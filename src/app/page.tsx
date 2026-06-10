import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import { PostCard } from "@/components/PostCard";
import { LoadMore } from "@/components/LoadMore";
import { loadMoreFeed } from "@/app/feed-actions";
import { FEED_SELECT, FEED_PAGE, feedWhere } from "@/lib/feed";
import { PushToggle } from "@/components/PushToggle";
import { stanceMeta } from "@/components/StanceBadge";
import { getCurrentUserId } from "@/lib/auth";
import { getMyVotes } from "@/lib/reactions";
import { getRecentFlips, getLeaderboard } from "@/lib/stance";
import { getLocale } from "@/lib/i18n-server";
import { getDict } from "@/lib/i18n";

export const dynamic = "force-dynamic";

// 首页右栏 mini 战绩榜 Top3(回测偏重,缓存 1h)。看板非核心:失败兜底空数组,绝不拖垮首页。
const getBoardTop = unstable_cache(
  async () => {
    try {
      return (await getLeaderboard()).slice(0, 3);
    } catch {
      return [];
    }
  },
  ["home-board-top"],
  { revalidate: 3600 },
);

// 首页 feed 查询缓存(30s):内容语言无关(双语都落库),按 (关注 ids 排序 + onlySignal) keyed,
// 削减 worker tick 期间每请求重打 DB 的并发成本(perf-1 数据级缓解;页面级 ISR 因 cookie 双语不可用)。
// postedAt 序列化前转 number、读后转回 Date —— unstable_cache 会把 Date 变字符串,relativeTime 用 .getTime() 会崩。
const getFeedPosts = unstable_cache(
  async (key: string) => {
    const { followIds, onlySignal } = JSON.parse(key) as { followIds: string[] | null; onlySignal: boolean };
    const rows = await prisma.post.findMany({ where: feedWhere(followIds, onlySignal), orderBy: { postedAt: "desc" }, take: FEED_PAGE, select: FEED_SELECT });
    return rows.map((p) => ({ ...p, postedAt: p.postedAt.getTime() }));
  },
  ["home-feed"],
  { revalidate: 30 },
);

export async function generateMetadata(): Promise<Metadata> {
  // 首页显式自指 canonical;并补回 RSS autodiscovery(子页设 alternates 会覆盖 layout 继承的 types)。
  return { alternates: { canonical: "/", types: { "application/rss+xml": [{ url: "/rss/all", title: "X2T" }] } } };
}

export default async function FeedPage({ searchParams }: { searchParams: Promise<{ view?: string; sig?: string }> }) {
  const { view, sig } = await searchParams;
  const locale = await getLocale();
  const t = getDict(locale);
  const uid = await getCurrentUserId();

  // 已关注 ids:登录→DB,匿名→cookie(由 follow-client 镜像)
  let followedIds: string[];
  if (uid) {
    followedIds = (await prisma.follow.findMany({ where: { userId: uid }, select: { influencerId: true } })).map((f) => f.influencerId);
  } else {
    const raw = (await cookies()).get("x2t_follows")?.value ?? "";
    followedIds = decodeURIComponent(raw).split(",").map((x) => x.trim()).filter(Boolean);
  }
  const following = view === "following" || (view !== "all" && followedIds.length > 0);
  // 默认"信号优先":只显示有多空观点的帖,把中性新闻搬运噪音压住;sig=0 才看全部。
  const onlySignal = sig !== "0";
  const v = following ? "following" : "all";
  const sigSuffix = onlySignal ? "" : "&sig=0";

  // manual 帖不进公共流(合规);feed 数据走 30s 缓存(getFeedPosts),postedAt 读回转 Date。
  const feedKey = JSON.stringify({ followIds: following ? [...followedIds].sort() : null, onlySignal });
  const posts = (await getFeedPosts(feedKey)).map((p) => ({ ...p, postedAt: new Date(p.postedAt) }));
  const feedCursor = posts.length === FEED_PAGE ? posts[posts.length - 1].postedAt.getTime() : null;
  // posts 已取;myVotes / 转向看板 / Top3 互不依赖 → 并行(消 RSC 串行瀑布,性能 P1-5)
  const [myVotes, rawFlips, boardTop] = await Promise.all([getMyVotes(posts.map((p) => p.id)), getRecentFlips(40), getBoardTop()]);
  const flips = (() => {
    const directionalFirst = [...rawFlips].sort(
      (a, b) =>
        Number(b.prevStance !== "neutral" && b.stance !== "neutral") - Number(a.prevStance !== "neutral" && a.stance !== "neutral"),
    );
    const seenPost = new Set<string>();
    const perInf = new Map<string, number>();
    const out: typeof rawFlips = [];
    for (const f of directionalFirst) {
      if (seenPost.has(f.postId)) continue;
      const c = perInf.get(f.handle) ?? 0;
      if (c >= 2) continue;
      seenPost.add(f.postId);
      perInf.set(f.handle, c + 1);
      out.push(f);
      if (out.length >= 6) break;
    }
    return out;
  })();

  return (
    <>
      <h1 className="page-title">{t.home.title}</h1>
      <p className="page-sub">{t.home.sub}</p>

      <div className="feed-toolbar">
        <div className="seg">
          <Link href={`/?view=all${sigSuffix}`} className={`segbtn${!following ? " on" : ""}`}>{t.home.viewAll}</Link>
          <Link href={`/?view=following${sigSuffix}`} className={`segbtn${following ? " on" : ""}`}>{t.home.viewFollowing}</Link>
        </div>
        <Link href={`/?view=${v}${onlySignal ? "&sig=0" : ""}`} className={`btn ${onlySignal ? "primary" : "ghost"}`}>
          {onlySignal ? t.home.onlySignal : t.home.showAll}
        </Link>
        <PushToggle />
        <a className="btn ghost" href="/rss/all">{t.home.allRss}</a>
      </div>

      <div className="cols-rail">
        <div className="ws-main">
          {following && followedIds.length === 0 ? (
            <div className="empty">
              {t.home.followEmpty} <Link href="/following" style={{ color: "var(--accent)" }}>{t.home.discover}</Link>
            </div>
          ) : posts.length === 0 ? (
            <div className="empty">
              {t.home.empty} <Link href="/submit" style={{ color: "var(--accent)" }}>{t.home.submitOne}</Link>。
            </div>
          ) : (
            <div className="feed">
              {posts.map((p) => (
                <PostCard key={p.id} post={{ ...p, myVote: myVotes[p.id] ?? 0 }} locale={locale} />
              ))}
              <LoadMore
                load={loadMoreFeed.bind(null, { view: v, sig: onlySignal ? "1" : "0" })}
                initialCursor={feedCursor}
                label={t.home.loadMore}
                loadingLabel={t.home.loading}
              />
            </div>
          )}
        </div>

        <aside className="col-sticky rail">
          {flips.length > 0 && (
            <div className="rail-card">
              <div className="rail-head">⇄ {t.home.flipsToday}</div>
              {flips.map((f) => (
                <Link key={`${f.handle}-${f.symbol}`} href={`/p/${f.postId}`} className="rail-flip" title={`${f.displayName ?? f.handle}: $${f.symbol}`}>
                  <span className="flip-sym">${f.symbol}</span>
                  <span className="flip-move">{stanceMeta(f.prevStance, locale).text}→{stanceMeta(f.stance, locale).text}</span>
                  <span className="rail-who">{f.displayName ?? f.handle}</span>
                </Link>
              ))}
              <Link href="/graph" className="rail-more">{t.home.flipsMore} →</Link>
            </div>
          )}
          {boardTop.length > 0 && (
            <div className="rail-card">
              <div className="rail-head">{t.board.title}</div>
              {boardTop.map((r, i) => (
                <Link key={r.handle} href={`/i/${r.handle}`} className="rail-rank" aria-label={`${i + 1}. ${r.displayName ?? r.handle}, ${Math.round(r.beatRate * 100)}% (${r.samples} ${t.influencer.samples})${r.significant ? ` · ${t.board.sigHint}` : ""}`}>
                  <span className="lb-rank">{i + 1}</span>
                  <span className="rail-rank-name">
                    {r.displayName ?? r.handle}
                    {r.significant && <span className="lb-sig" title={t.board.sigHint}>★</span>}
                  </span>
                  {/* 带样本数,避免 n=10 的 80% 与 n=200 的 80% 在首页不可区分(诚实性) */}
                  <span className={r.beatRate >= 0.5 ? "up" : "dn"}>{Math.round(r.beatRate * 100)}% · {r.samples}</span>
                </Link>
              ))}
              <Link href="/leaderboard" className="rail-more">{t.board.title} →</Link>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
