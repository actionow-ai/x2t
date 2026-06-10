import Link from "next/link";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import { PostCard } from "@/components/PostCard";
import { FollowButton } from "@/components/FollowButton";
import { AvatarInner } from "@/components/Avatar";
import { StanceBadge } from "@/components/StanceBadge";
import { EquitySparkline } from "@/components/EquitySparkline";
import { ShareButton } from "@/components/ShareButton";
import { getCurrentUserId } from "@/lib/auth";
import { isNewsAccount } from "@/lib/account";
import { getMyVotes } from "@/lib/reactions";
import { getInfluencerLedger, getInfluencerBacktest } from "@/lib/stance";
import { formatDateTime } from "@/lib/time";
import { getLocale } from "@/lib/i18n-server";
import { getDict } from "@/lib/i18n";
import { profilePageJsonLd, breadcrumbJsonLd, SITE_URL } from "@/lib/seo";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

// 胜率 + 权益曲线一次结算(回测偏重,缓存 1 小时),移出首屏同步路径(工程审计 P0)。
const getBacktest = unstable_cache((id: string) => getInfluencerBacktest(id), ["influencer-backtest"], { revalidate: 3600 });

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const { handle } = await params;
  const en = (await getLocale()) === "en";
  const inf = await prisma.influencer.findFirst({ where: { handle }, select: { id: true, handle: true, displayName: true, bio: true } });
  if (!inf) return {};
  const name = inf.displayName ?? inf.handle;
  // 不在 generateMetadata 里调 getBacktest(unstable_cache+resolveCalls):它在 metadata 上下文会抛错,
  // 导致整个 generateMetadata 回退默认 → canonical 丢失(SEO P0)。战绩数字在页面正文展示;此处保证 canonical 一定输出。
  const title = en ? `${name} (@${inf.handle}) — stance & track record` : `${name}(@${inf.handle})· 立场与战绩`;
  const description = (en ? `${name}'s stance ledger, win-rate vs S&P 500 and recent flips on X2T. ${inf.bio ?? ""}` : `${name} 在 X2T 的立场账本、跑赢大盘率与近期转向。${inf.bio ?? ""}`)
    .trim()
    .slice(0, 160);
  const url = `/i/${encodeURIComponent(inf.handle)}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: "profile", title, description, url, images: ["/og.png"] },
    twitter: { card: "summary_large_image", title, description, images: ["/og.png"] },
  };
}

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
    orderBy: { platform: "asc" }, // 同 handle 多平台时优先真实抓取源(manual 排最后,防冒名串页)
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
          likeCount: true,
          dislikeCount: true,
        },
      },
    },
  });
  if (!influencer) notFound();
  const myVotes = await getMyVotes(influencer.posts.map((p) => p.id));

  const name = influencer.displayName ?? influencer.handle;

  // 客观战绩(平台统计,非博主自述):覆盖标的数 + 立场分布。用 groupBy 聚合而非拉全部 ticker 行(性能 P1-5)。
  const stanceCounts = await prisma.postTicker.groupBy({ by: ["stance"], where: { post: { influencerId: influencer.id } }, _count: { _all: true } });
  const bull = stanceCounts.find((s) => s.stance === "bullish")?._count._all ?? 0;
  const bear = stanceCounts.find((s) => s.stance === "bearish")?._count._all ?? 0;
  const neut = stanceCounts.find((s) => s.stance === "neutral")?._count._all ?? 0;
  const total = bull + bear + neut;
  const symbolCount = (await prisma.postTicker.findMany({ where: { post: { influencerId: influencer.id } }, select: { symbol: true }, distinct: ["symbol"] })).length;
  // T1.6 多空倾向解读:看多占(多+空)的比例
  const directional = bull + bear;
  const bias = directional < 3 ? null : bull / directional >= 0.66 ? t.influencer.biasBull : bull / directional <= 0.34 ? t.influencer.biasBear : t.influencer.biasBalanced;
  // T2.1 立场账本:对各标的的当前立场 + 转向
  const ledger = await getInfluencerLedger(influencer.id);
  // T2.5 历史胜率 + 权益曲线:一次 resolveCalls 同时出两者(缓存 1h)
  const bt = await getBacktest(influencer.id);
  const winRate = bt.winRate;
  const equity = bt.equity;

  const userId = await getCurrentUserId();
  const followed = userId
    ? !!(await prisma.follow.findUnique({ where: { userId_influencerId: { userId, influencerId: influencer.id } } }))
    : false;

  return (
    <div className="cols-side">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            profilePageJsonLd({
              url: `${SITE_URL}/i/${encodeURIComponent(influencer.handle)}`,
              handle: influencer.handle,
              displayName: influencer.displayName,
              description: (influencer.bio ?? `${name} · X2T`).slice(0, 200),
              locale,
            }),
            breadcrumbJsonLd([
              { name: "X2T", url: SITE_URL },
              { name, url: `${SITE_URL}/i/${encodeURIComponent(influencer.handle)}` },
            ]),
          ]),
        }}
      />
      <aside className="col-sticky inf-side">
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
            {" · "}
            <a href={`mailto:actionow.ai@gmail.com?subject=${encodeURIComponent(`X2T 更正/移除: @${influencer.handle}`)}`} style={{ color: "var(--text-tertiary)", textDecoration: "underline" }}>
              {t.influencer.claimRemove}
            </a>
          </div>
          {/* T1.1+T1.6:客观战绩打头 + 多空倾向解读;博主自述 bio 折叠到次要位置,不当平台背书 */}
          {total > 0 && (
            <div className="track-row" title={t.influencer.trackHint}>
              <span><b>{symbolCount}</b> {t.influencer.covered}</span>
              <span><b>{total}</b> {t.influencer.calls}</span>
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
              <EquitySparkline points={equity.points} locale={locale} />
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
            {winRate?.rate && (
              <ShareButton
                spec={{
                  brandLine: `${name} · X2T`,
                  headline:
                    locale === "en"
                      ? `Beat S&P ${Math.round(winRate.rate.beatRate * 100)}% over ${winRate.samples} calls`
                      : `跑赢大盘 ${Math.round(winRate.rate.beatRate * 100)}%(${winRate.samples} 次判断)`,
                  sub: equity ? `vs SPY ${equity.totalSpy > 0 ? "+" : ""}${(equity.totalSpy * 100).toFixed(0)}%` : undefined,
                  accent: winRate.rate.ci[0] > 0.5 ? "bull" : "neutral",
                  tweetText:
                    locale === "en"
                      ? `${name} on X2T: beat the S&P ${Math.round(winRate.rate.beatRate * 100)}% of the time over ${winRate.samples} calls.`
                      : `${name} 在 X2T 的战绩:${winRate.samples} 次判断里 ${Math.round(winRate.rate.beatRate * 100)}% 跑赢大盘。`,
                  url: `/i/${influencer.handle}`,
                  via: influencer.platform === "twitter" ? influencer.handle : undefined,
                }}
              />
            )}
          </div>
        </div>
      </div>

      {ledger.length > 0 && (
        <details className="ledger">
          <summary className="label-sm ledger-summary">{t.influencer.ledgerTitle}（{ledger.length}）</summary>
          <div className="ledger-grid">
            {ledger.map((e) => (
              <Link key={e.symbol} href={`/t/${e.symbol}`} className="ledger-chip" data-stance={e.stance}>
                <StanceBadge stance={e.stance} locale={locale} />
                <span className="ledger-sym">${e.symbol}</span>
                {e.flipped && <span className="ledger-flip" title={t.consensus.flipped}>⇄</span>}
              </Link>
            ))}
          </div>
        </details>
      )}
      </aside>

      <div className="inf-main">
      {influencer.posts.length === 0 ? (
        <div className="empty">{t.influencer.noPosts}</div>
      ) : (
        <div className="feed">
          {influencer.posts.map((p) => (
            <PostCard key={p.id} post={{ ...p, myVote: myVotes[p.id] ?? 0 }} locale={locale} />
          ))}
        </div>
      )}
      </div>
    </div>
  );
}
