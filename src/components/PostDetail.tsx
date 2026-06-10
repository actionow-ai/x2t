import { prisma } from "@/lib/db";
import type { ExternalData } from "@/lib/marketdata";
import { PostContentTabs } from "./PostContentTabs";
import { StanceBadge, stanceText } from "./StanceBadge";
import { Reactions } from "./Reactions";
import { getMyVotes } from "@/lib/reactions";
import { AvatarInner } from "./Avatar";
import { formatDateTime } from "@/lib/time";
import { getDict, type Locale } from "@/lib/i18n";
import Link from "next/link";

// 取一条帖子的完整详情数据（post + 每只票的外部数据缓存）。供整页详情 + 双栏右侧共用。
export async function getPostDetail(id: string) {
  const post = await prisma.post.findUnique({
    where: { id },
    select: {
      id: true,
      contentText: true,
      contentZh: true,
      contentEn: true,
      lang: true,
      url: true,
      postedAt: true,
      analysisStatus: true,
      likeCount: true,
      dislikeCount: true,
      influencer: { select: { handle: true, displayName: true, avatarUrl: true, platform: true } },
      analysis: { select: { summary: true, summaryEn: true, keyPoints: true, keyPointsEn: true, overallStance: true, confidence: true, model: true } },
      tickers: { select: { symbol: true, stance: true, rationale: true, rationaleEn: true } },
    },
  });
  if (!post) return null;

  const symbols = post.tickers.map((t) => t.symbol);
  // 合并 bundle(行情/概况/新闻) + sentiment + events 三类缓存(各存独立行),每类取最新
  const caches = symbols.length
    ? await prisma.externalDataCache.findMany({
        where: { symbol: { in: symbols }, dataType: { in: ["bundle", "sentiment", "events"] } },
        orderBy: { fetchedAt: "desc" },
        select: { symbol: true, dataType: true, payload: true },
      })
    : [];
  const dataBySymbol = new Map<string, ExternalData>();
  const seen = new Set<string>();
  for (const c of caches) {
    const key = `${c.symbol}:${c.dataType}`;
    if (seen.has(key)) continue; // 每 (symbol,dataType) 取最新一条
    seen.add(key);
    const p = c.payload as Record<string, unknown> | null;
    if (!p) continue;
    const cur = dataBySymbol.get(c.symbol) ?? ({} as ExternalData);
    if (c.dataType === "bundle") Object.assign(cur, p);
    else if (c.dataType === "sentiment" && typeof (p as { score?: unknown }).score === "number") cur.sentiment = p as ExternalData["sentiment"];
    else if (c.dataType === "events" && Array.isArray(p) && p.length) cur.events = p as ExternalData["events"];
    dataBySymbol.set(c.symbol, cur);
  }

  const myVote = (await getMyVotes([id]))[id] ?? 0;
  return { post, dataBySymbol, myVote };
}

type Detail = NonNullable<Awaited<ReturnType<typeof getPostDetail>>>;

export function PostDetail({ post, dataBySymbol, myVote, locale = "zh" }: Detail & { locale?: Locale }) {
  const inf = post.influencer;
  const name = inf.displayName ?? inf.handle;
  const t = getDict(locale);
  const en = locale === "en";
  const kpRaw = en && post.analysis?.keyPointsEn ? post.analysis.keyPointsEn : post.analysis?.keyPoints;
  const keyPoints = (kpRaw as string[] | undefined) ?? [];
  const summary = post.analysis ? (en && post.analysis.summaryEn ? post.analysis.summaryEn : post.analysis.summary) : "";

  return (
    <div className="cols-split post-detail">
      <article className="post-card" data-stance={post.analysis?.overallStance}>
      <div className="pc-top">
        <Link href={`/i/${inf.handle}`} className="pc-av"><AvatarInner src={inf.avatarUrl} name={name} /></Link>
        <div>
          <Link href={`/i/${inf.handle}`}>
            <div className="pc-name">{name}</div>
          </Link>
          <div className="pc-handle">@{inf.handle} · {formatDateTime(post.postedAt, locale)}{inf.platform === "manual" && <span className="news-tag" style={{ marginLeft: "0.4rem" }}>{t.post.unverified}</span>}</div>
        </div>
      </div>

      <PostContentTabs
        original={post.contentText}
        zh={post.contentZh || post.contentText}
        en={post.contentEn || post.contentText}
        origLang={post.lang}
        originalLabel={t.post.original}
        defaultTab={en ? "en" : "zh"}
      />
      <div className="card-foot">
      <div className="pc-src">
        {post.url && <a href={post.url} target="_blank" rel="noreferrer">{t.common.originalPost} ↗</a>}
        <span>{t.common.notFinancialAdvice}</span>
      </div>
      <Reactions
        postId={post.id}
        likes={post.likeCount}
        dislikes={post.dislikeCount}
        myVote={myVote}
        share={{
          brandLine: `${name}${post.tickers[0] ? ` · $${post.tickers[0].symbol}` : ""}`,
          headline: summary ? summary.slice(0, 56) : post.tickers[0] ? `$${post.tickers[0].symbol}` : name,
          sub: post.analysis ? `${t.stance.overallPrefix}${stanceText(post.analysis.overallStance, locale)}` : undefined,
          accent: post.analysis?.overallStance === "bullish" ? "bull" : post.analysis?.overallStance === "bearish" ? "bear" : "neutral",
          tweetText: en
            ? `${name}${post.tickers[0] ? ` on $${post.tickers[0].symbol}` : ""}${post.analysis ? `: ${stanceText(post.analysis.overallStance, locale)}` : ""}${summary ? ` — ${summary.slice(0, 80)}` : ""}`
            : `${name}${post.tickers[0] ? ` 对 $${post.tickers[0].symbol}` : ""}${post.analysis ? `:${stanceText(post.analysis.overallStance, locale)}` : ""}${summary ? ` — ${summary.slice(0, 80)}` : ""}`,
          via: inf.platform === "twitter" ? inf.handle : undefined,
        }}
      />
      </div>
      </article>

      <div className="post-analysis">
      {post.analysis ? (
        <div className="ai-box">
          <div className="ai-label">{t.post.ai}</div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
            <StanceBadge stance={post.analysis.overallStance} locale={locale} label={`${t.stance.overallPrefix}${stanceText(post.analysis.overallStance, locale)}`} />
            {typeof post.analysis.confidence === "number" && (
              // 定性档而非伪精确百分比:避免"看多置信度70%"诱导跟单
              <span className="conf-pill">
                {post.analysis.confidence >= 0.66 ? t.post.confHigh : post.analysis.confidence >= 0.4 ? t.post.confMed : t.post.confLow}
              </span>
            )}
            {/* 紧贴立场的 AI 免责微提示(把免责贴到伤害点);不再泄露内部模型串 */}
            <span className="ai-hint" style={{ marginLeft: "auto" }}>{t.post.aiHint}</span>
          </div>

          <div style={{ fontSize: "0.86rem", lineHeight: 1.5, marginBottom: "0.6rem" }}>{summary}</div>

          {post.tickers.length > 0 && (
            <>
              <div className="label-sm">{t.post.tickers}（{post.tickers.length}）</div>
              {post.tickers.map((tk) => {
                const ext = dataBySymbol.get(tk.symbol);
                return (
                  <div key={tk.symbol} className="tcard">
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.3rem" }}>
                      <StanceBadge stance={tk.stance} locale={locale} />
                      <Link href={`/t/${tk.symbol}`} className="tcard-sym"><strong>${tk.symbol}</strong></Link>
                      {ext?.profile?.name && (
                        <span style={{ fontSize: "0.7rem", color: "var(--text-tertiary)", marginLeft: "auto" }}>{ext.profile.name}</span>
                      )}
                    </div>
                    {(en && tk.rationaleEn ? tk.rationaleEn : tk.rationale) && (
                      <div style={{ fontSize: "0.78rem", marginBottom: "0.3rem" }}>{en && tk.rationaleEn ? tk.rationaleEn : tk.rationale}</div>
                    )}
                    {ext?.quote && (
                      <div className="ext-line">
                        {t.post.quote} ${ext.quote.price}{" "}
                        <span className={ext.quote.changePct >= 0 ? "up" : "dn"}>
                          {ext.quote.changePct >= 0 ? "▲" : "▼"}
                          {Math.abs(ext.quote.changePct)}%
                        </span>
                      </div>
                    )}
                    {ext?.news && ext.news.length > 0 && (
                      <div className="ext-line">{t.post.news} {ext.news.slice(0, 2).map((n) => n.headline).join(" · ")}</div>
                    )}
                    {ext?.sentiment && typeof ext.sentiment.score === "number" && (() => {
                      const sc = ext.sentiment!.score;
                      // 背离:博主立场与市场新闻情绪相悖 —— 这是产品真洞见,显式标出而非藏起来
                      const diverges = (tk.stance === "bullish" && sc <= -0.15) || (tk.stance === "bearish" && sc >= 0.15);
                      return (
                        <div className="ext-line">
                          {t.post.sentiment} <span className={sc >= 0.15 ? "up" : sc <= -0.15 ? "dn" : ""}>{ext!.sentiment!.label}</span>
                          {diverges && <span className="diverge-chip" title={t.post.divergenceHint}>{t.post.divergence}</span>}
                        </div>
                      );
                    })()}
                    {ext?.events && ext.events.length > 0 && (
                      <div className="ext-line">{t.post.events} {ext.events.map((e) => `${e.title} · ${e.date}`).join(" · ")}</div>
                    )}
                  </div>
                );
              })}
            </>
          )}

          {keyPoints.length > 0 && (
            <>
              <div className="label-sm">{t.post.keyPoints}</div>
              <ul style={{ margin: "0 0 0.3rem 1.1rem" }}>
                {keyPoints.map((k, i) => (
                  <li key={i} style={{ fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>{k}</li>
                ))}
              </ul>
            </>
          )}

          <div style={{ fontSize: "0.7rem", color: "var(--text-tertiary)", marginTop: "0.5rem" }}>
            {t.post.disclaimer}
          </div>
        </div>
      ) : (
        <div className="ai-box">
          <div className="ai-label">{t.post.ai}</div>
          <div style={{ color: "var(--text-tertiary)", fontSize: "0.82rem" }}>
            {post.analysisStatus === "failed" ? t.post.failedHint : t.post.analyzingHint}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
