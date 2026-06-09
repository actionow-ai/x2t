import Link from "next/link";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { PostCard } from "@/components/PostCard";
import { PushToggle } from "@/components/PushToggle";
import { SelectableFeed } from "@/components/SelectableFeed";
import { getPostDetail, PostDetail } from "@/components/PostDetail";
import { stanceMeta } from "@/components/StanceBadge";
import { getCurrentUserId } from "@/lib/auth";
import { getRecentFlips } from "@/lib/stance";
import { getLocale } from "@/lib/i18n-server";
import { getDict } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function FeedPage({ searchParams }: { searchParams: Promise<{ s?: string; view?: string; sig?: string }> }) {
  const { s, view, sig } = await searchParams;
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
  // 默认"信号优先":只显示有多空观点的帖,把中性新闻搬运噪音压住(UX 审计 P0);sig=0 才看全部。
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
    // 显式 select:只取卡片用到的列,绝不带出 rawJson/mediaJson 大字段
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
    },
  });
  const detail = s ? await getPostDetail(s) : null;
  const flips = await getRecentFlips(8); // 今日转向头条(护城河信号)

  return (
    <>
      <h1 className="page-title">{t.home.title}</h1>
      <p className="page-sub">{t.home.sub}</p>

      {flips.length > 0 && (
        <div className="flip-strip" aria-label={t.home.flipsToday}>
          <span className="flip-strip-label">⇄ {t.home.flipsToday}</span>
          {flips.map((f) => (
            <Link key={`${f.handle}-${f.symbol}`} href={`/p/${f.postId}`} className="flip-chip" title={`${f.displayName ?? f.handle}: $${f.symbol}`}>
              <span className="flip-who">{f.displayName ?? f.handle}</span>
              <span className="flip-sym">${f.symbol}</span>
              <span className="flip-move">{stanceMeta(f.prevStance, locale).arrow}→{stanceMeta(f.stance, locale).arrow}</span>
            </Link>
          ))}
          <Link href="/graph" className="flip-more">{t.home.flipsMore} →</Link>
        </div>
      )}

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

      {following && followedIds.length === 0 ? (
        <div className="empty">
          {t.home.followEmpty} <Link href="/following" style={{ color: "var(--accent)" }}>{t.home.discover}</Link>
        </div>
      ) : posts.length === 0 ? (
        <div className="empty">
          {t.home.empty} <Link href="/submit" style={{ color: "var(--accent)" }}>{t.home.submitOne}</Link>。
        </div>
      ) : (
        <div className={`workspace${detail ? " split" : ""}`}>
          <div className="ws-list">
            <SelectableFeed>
              <div className="feed">
                {posts.map((p) => (
                  <PostCard key={p.id} post={p} selected={p.id === s} locale={locale} />
                ))}
              </div>
            </SelectableFeed>
          </div>

          {detail && (
            <div className="ws-detail">
              <div className="ws-detail-bar">
                <Link href="/" scroll={false} className="btn ghost">{t.home.collapse}</Link>
                <Link href={`/p/${detail.post.id}`} className="btn ghost">{t.home.fullPage}</Link>
              </div>
              <PostDetail post={detail.post} dataBySymbol={detail.dataBySymbol} locale={locale} />
            </div>
          )}
        </div>
      )}
    </>
  );
}
