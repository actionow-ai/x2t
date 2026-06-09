import Link from "next/link";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import { PostCard } from "@/components/PostCard";
import { FollowButton } from "@/components/FollowButton";
import { AvatarInner } from "@/components/Avatar";
import { StanceBadge } from "@/components/StanceBadge";
import { EquitySparkline } from "@/components/EquitySparkline";
import { getCurrentUserId } from "@/lib/auth";
import { isNewsAccount } from "@/lib/account";
import { getInfluencerLedger, getInfluencerWinRate, getInfluencerEquityCurve } from "@/lib/stance";
import { formatDateTime } from "@/lib/time";
import { getLocale } from "@/lib/i18n-server";
import { getDict } from "@/lib/i18n";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

// 胜率/权益曲线回算偏重,缓存 1 小时,移出首屏同步路径(工程审计 P0)。
const getWinRateCached = unstable_cache((id: string) => getInfluencerWinRate(id), ["influencer-winrate"], { revalidate: 3600 });
const getEquityCached = unstable_cache((id: string) => getInfluencerEquityCurve(id), ["influencer-equity"], { revalidate: 3600 });

export default async function InfluencerPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const locale = await getLocale();
  const t = getDict(locale);

  const influencer = await prisma.influencer.findFirst({
    where: { handle },
    include: {
      posts: {
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
        },
      },
    },
  });
  if (!influencer) notFound();

  const name = influencer.displayName ?? influencer.handle;

  // 客观战绩(平台统计,非博主自述):覆盖标的数 + 立场分布。替代不可验证的吹捧 bio。
  const tickerRows = await prisma.postTicker.findMany({
    where: { post: { influencerId: influencer.id } },
    select: { symbol: true, stance: true },
  });
  const symbolSet = new Set(tickerRows.map((r) => r.symbol));
  const bull = tickerRows.filter((r) => r.stance === "bullish").length;
  const bear = tickerRows.filter((r) => r.stance === "bearish").length;
  const neut = tickerRows.filter((r) => r.stance === "neutral").length;
  // T1.6 多空倾向解读:看多占(多+空)的比例
  const directional = bull + bear;
  const bias = directional < 3 ? null : bull / directional >= 0.66 ? t.influencer.biasBull : bull / directional <= 0.34 ? t.influencer.biasBear : t.influencer.biasBalanced;
  // T2.1 立场账本:对各标的的当前立场 + 转向
  const ledger = await getInfluencerLedger(influencer.id);
  // T2.5 历史胜率(跑赢大盘率,平台回算;样本<30 或无基准时为 null;缓存 1h)
  const winRate = await getWinRateCached(influencer.id);
  // 波Q "如果跟单 vs 大盘"权益曲线(借 Vibe/AI-Trader)
  const equity = await getEquityCached(influencer.id);

  const userId = await getCurrentUserId();
  const followed = userId
    ? !!(await prisma.follow.findUnique({ where: { userId_influencerId: { userId, influencerId: influencer.id } } }))
    : false;

  return (
    <>
      <div className="inf-header">
        <div className="inf-av"><AvatarInner src={influencer.avatarUrl} name={name} /></div>
        <div style={{ flex: 1 }}>
          <div className="inf-name">
            {name}
            {isNewsAccount(influencer.handle) && (
              <span className="news-tag" title={t.influencer.newsAccountHint}>{t.influencer.newsAccount}</span>
            )}
          </div>
          <div className="inf-handle">
            @{influencer.handle} · {influencer.platform}
          </div>
          <div className="inf-meta">
            {influencer.posts.length} {t.influencer.postsWord}
            {influencer.lastFetchedAt ? ` · ${t.influencer.lastFetch} ${formatDateTime(influencer.lastFetchedAt, locale)}` : ""}
          </div>
          {/* T1.1+T1.6:客观战绩打头 + 多空倾向解读;博主自述 bio 折叠到次要位置,不当平台背书 */}
          {tickerRows.length > 0 && (
            <div className="track-row" title={t.influencer.trackHint}>
              <span><b>{symbolSet.size}</b> {t.influencer.covered}</span>
              <span><b>{tickerRows.length}</b> {t.influencer.calls}</span>
              <span className="up">▲{bull}</span>
              <span className="dn">▼{bear}</span>
              <span style={{ color: "var(--text-tertiary)" }}>●{neut}</span>
              {bias && <span className="bias-tag">{bias}</span>}
              {winRate && winRate.rate && (
                <span className="bias-tag" title={t.influencer.winRateHint} style={{ background: winRate.rate.ci[0] > 0.5 ? "var(--lime)" : "var(--bg-secondary)" }}>
                  {t.influencer.winRate} {Math.round(winRate.rate.beatRate * 100)}% ({Math.round(winRate.rate.ci[0] * 100)}–{Math.round(winRate.rate.ci[1] * 100)}%) · {winRate.samples} {t.influencer.samples}
                  {winRate.rate.avgExcess !== 0 && <> · {t.influencer.winRateExcess} {winRate.rate.avgExcess > 0 ? "+" : ""}{(winRate.rate.avgExcess * 100).toFixed(1)}%</>}
                  {winRate.rate.lowSample ? ` · ${t.influencer.winRateLow}` : ""}
                </span>
              )}
              {winRate && !winRate.rate && (
                <span className="bias-tag" title={t.influencer.winRateHint} style={{ background: "var(--bg-secondary)", color: "var(--text-tertiary)" }}>
                  {t.influencer.winRateBuilding} {winRate.samples}/10
                </span>
              )}
            </div>
          )}
          {equity && (
            <div className="equity-wrap">
              <EquitySparkline points={equity.points} />
              <div className="equity-cap">
                <span style={{ color: "var(--blue)", fontWeight: 700 }}>
                  {t.board.followCurve}: {equity.totalFollow > 0 ? "+" : ""}{(equity.totalFollow * 100).toFixed(1)}%
                </span>
                <span>SPY {equity.totalSpy > 0 ? "+" : ""}{(equity.totalSpy * 100).toFixed(1)}%</span>
              </div>
            </div>
          )}
          {influencer.bio && (
            <details className="orig-text" style={{ marginTop: "0.4rem" }}>
              <summary>{t.influencer.bioMore}</summary>
              <div className="inf-bio" style={{ marginTop: "0.3rem" }}>{influencer.bio}</div>
            </details>
          )}
          {influencer.fetchError && (
            <div className="inf-meta" style={{ color: "var(--error)", marginTop: "0.3rem" }}>
              {t.influencer.fetchError}：{influencer.fetchError}
            </div>
          )}
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.7rem", flexWrap: "wrap" }}>
            <FollowButton influencerId={influencer.id} isLoggedIn={!!userId} initiallyFollowed={followed} />
            <a className="btn ghost" href={`/i/${influencer.handle}/rss`}>{t.influencer.rss}</a>
          </div>
        </div>
      </div>

      {ledger.length > 0 && (
        <section className="ledger">
          <div className="label-sm">{t.influencer.ledgerTitle}（{ledger.length}）</div>
          <div className="ledger-grid">
            {ledger.map((e) => (
              <Link key={e.symbol} href={`/t/${e.symbol}`} className="ledger-chip" data-stance={e.stance}>
                <StanceBadge stance={e.stance} locale={locale} />
                <span className="ledger-sym">${e.symbol}</span>
                {e.flipped && <span className="ledger-flip" title={t.consensus.flipped}>⇄</span>}
              </Link>
            ))}
          </div>
        </section>
      )}

      {influencer.posts.length === 0 ? (
        <div className="empty">{t.influencer.noPosts}</div>
      ) : (
        <div className="feed">
          {influencer.posts.map((p) => (
            <PostCard key={p.id} post={p} locale={locale} />
          ))}
        </div>
      )}
    </>
  );
}
