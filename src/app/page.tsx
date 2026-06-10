import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import { PostCard } from "@/components/PostCard";
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

export async function generateMetadata(): Promise<Metadata> {
  // 首页显式自指 canonical(根布局不再设 canonical,避免被子页继承);title/描述继承站点默认。
  return { alternates: { canonical: "/" } };
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

  const where = {
    ...(following ? { influencerId: { in: followedIds.length ? followedIds : ["__none__"] } } : {}),
    ...(onlySignal ? { analysis: { overallStance: { in: ["bullish", "bearish"] as ("bullish" | "bearish")[] } } } : {}),
  };
  const posts = await prisma.post.findMany({
    where,
    orderBy: { postedAt: "desc" },
    take: 50,
    select: {
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
    },
  });
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
                <Link key={r.handle} href={`/i/${r.handle}`} className="rail-rank" title={`${r.samples} ${t.influencer.samples}`}>
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
