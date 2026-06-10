import { cache } from "react";
import { unstable_cache } from "next/cache";
import type { Metadata } from "next";
import { getStockConsensus, getStockDebate, getStockStanceTimeline } from "@/lib/stance";
import { StancePriceChart } from "@/components/StancePriceChart";
import { isNewsAccount } from "@/lib/account";
import { ShareButton } from "@/components/ShareButton";
import { StanceBadge, stanceMeta } from "@/components/StanceBadge";
import { relativeTime } from "@/lib/time";
import { getLocale } from "@/lib/i18n-server";
import { getDict } from "@/lib/i18n";
import { breadcrumbJsonLd, SITE_URL, pageMetadata, ogImageUrl } from "@/lib/seo";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

const COLOR: Record<string, string> = {
  bullish: "var(--success)",
  bearish: "var(--error)",
  neutral: "var(--text-tertiary)",
};

// 跨请求缓存(120s)+ 同请求 React cache 去重:generateMetadata 与页面只算一次,热门票也不每访问都全扫。
const consensusCached = cache((symbol: string) => unstable_cache(() => getStockConsensus(symbol), ["stock-consensus", symbol], { revalidate: 120 })());
const debateCached = cache((symbol: string, locale: "zh" | "en") => unstable_cache(() => getStockDebate(symbol, locale), ["stock-debate", symbol, locale], { revalidate: 120 })());
const timelineCached = cache((symbol: string) => unstable_cache(() => getStockStanceTimeline(symbol), ["stance-timeline", symbol], { revalidate: 300 })());

export async function generateMetadata({ params }: { params: Promise<{ symbol: string }> }): Promise<Metadata> {
  const { symbol } = await params;
  const en = (await getLocale()) === "en";
  const c = await consensusCached(symbol);
  const n = c.stances.length;
  const sym = c.symbol;
  const lean =
    c.bullish > c.bearish ? (en ? "leaning bullish" : "整体偏多") : c.bearish > c.bullish ? (en ? "leaning bearish" : "整体偏空") : en ? "split" : "多空分歧";
  const title =
    n > 0
      ? en
        ? `$${sym}${c.name ? ` (${c.name})` : ""}: ${n} influencers, ${c.bullish} bull / ${c.bearish} bear`
        : `$${sym}${c.name ? ` · ${c.name}` : ""}:${n} 位博主共识 ▲${c.bullish} ▼${c.bearish}`
      : en
        ? `$${sym}: influencer consensus`
        : `$${sym}:财经博主共识`;
  const description = (
    en
      ? `What financial influencers say about $${sym}: ${n} tracked, ${lean}. Bull-vs-bear cases, stance flips and AI analysis on X2T.`
      : `财经博主怎么看 $${sym}:${n} 位在追踪,${lean}。多空辩论、立场转向、AI 双语分析,尽在 X2T。`
  ).slice(0, 160);
  const ogImage =
    n > 0
      ? ogImageUrl({
          brand: `${n} influencer${n === 1 ? "" : "s"} tracking · last 12mo`,
          headline: `$${sym}`,
          sub: `${c.bullish} bull · ${c.bearish} bear`,
          accent: c.bullish > c.bearish ? "bull" : c.bearish > c.bullish ? "bear" : "neutral",
          sym, // → OG 卡嵌入"净立场 vs 价格"迷你走势图
        })
      : undefined;
  return pageMetadata({ path: `/t/${encodeURIComponent(sym)}`, title, description, ogType: "website", noindex: n === 0, ogImage });
}

export default async function StockPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const locale = await getLocale();
  const t = getDict(locale);
  const c = await consensusCached(symbol);
  // 任意不存在/无人点评的票不渲染可索引薄页(软404 索引污染) → 返回真实 404(seo-3)
  if (c.stances.length === 0) notFound();
  const debate = await debateCached(symbol, locale === "en" ? "en" : "zh");
  const timeline = await timelineCached(symbol);

  const cx = 170;
  const cy = 150;
  const R = 110;
  const n = c.stances.length;
  const nodes = c.stances.map((s, i) => {
    const angle = n === 1 ? -Math.PI / 2 : (2 * Math.PI * i) / n - Math.PI / 2;
    return { ...s, x: cx + R * Math.cos(angle), y: cy + R * Math.sin(angle) };
  });

  const overall = c.bullish > c.bearish ? "bullish" : c.bearish > c.bullish ? "bearish" : "neutral";
  const flips = c.stances.filter((s) => s.flipped).length;
  // 小样本(<5 人)不下"裁决"、不按方向染色,只列原始票数(方法论审计 P1)。
  const small = n < 5;
  const verdict = small ? null : overall === "bullish" ? t.consensus.verdictBull : overall === "bearish" ? t.consensus.verdictBear : t.consensus.verdictNeutral;

  return (
    <>
      {/* 包进真实元素(display:contents 布局中性):Fragment 根部裸 <script> 会被 React App Router 提升/去重丢弃(seo-2) */}
      <div style={{ display: "contents" }}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(
              breadcrumbJsonLd([
                { name: "X2T", url: SITE_URL },
                { name: `$${c.symbol}`, url: `${SITE_URL}/t/${encodeURIComponent(c.symbol)}` },
              ]),
            ),
          }}
        />
      </div>
      <h1 className="page-title">
        ${c.symbol}
        {c.name && (
          <span style={{ fontSize: "0.9rem", color: "var(--text-secondary)", fontWeight: 400 }}> · {c.name}</span>
        )}
      </h1>
      <p className="page-sub">
        {t.consensus.whoTalking} ${c.symbol} · {t.consensus.verdictPrefix} {n} {t.consensus.peopleWord}
        {verdict ? <>，<strong>{verdict}</strong>{" "}</> : "："}
        <StanceBadge stance={verdict ? overall : "neutral"} locale={locale} label={`▲${c.bullish} ▼${c.bearish} · ${c.neutral} ${t.stance.neutral}`} />
        {flips > 0 ? ` · ${flips} ${t.consensus.flipNote}` : ""}
      </p>
      {n > 0 && (
        <p className="method-note">
          {small ? `${t.consensus.smallSample} · ` : ""}
          {t.consensus.methodNote}
        </p>
      )}
      {n > 0 && (
        <ShareButton
          spec={{
            brandLine: `$${c.symbol}${c.name ? ` · ${c.name}` : ""}`,
            headline: `${t.consensus.verdictPrefix} ${n} ${t.consensus.peopleWord}${verdict ? `，${verdict}` : ""}`,
            sub: `▲${c.bullish} ▼${c.bearish} · ${c.neutral} ${t.stance.neutral}`,
            accent: verdict && overall === "bullish" ? "bull" : verdict && overall === "bearish" ? "bear" : "neutral",
            tweetText: `$${c.symbol}: ${verdict ?? `▲${c.bullish} ▼${c.bearish}`} — ${t.consensus.verdictPrefix} ${n} ${t.consensus.peopleWord}。`,
          }}
        />
      )}

      {timeline.length >= 2 && (
        <section style={{ margin: "0.8rem 0" }}>
          <div style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: "0.3rem" }} title={t.consensus.stancePriceHint}>
            {t.consensus.stancePriceTitle}
          </div>
          <StancePriceChart points={timeline} locale={locale === "en" ? "en" : "zh"} />
          <div className="equity-cap" style={{ marginTop: "0.2rem" }}>
            <span style={{ color: "var(--blue)", fontWeight: 700 }}>{t.consensus.legendNetStance}</span>
            <span style={{ color: "var(--text-tertiary)" }}>{t.consensus.legendPrice}</span>
          </div>
        </section>
      )}

      {n === 0 ? (
        <div className="empty">{t.consensus.noOne} ${c.symbol}。</div>
      ) : (
        <div className="cols-split">
          <div className="col-sticky">
            <div className="post-card" style={{ padding: "0.4rem" }}>
            <svg viewBox="0 0 340 300" width="100%" height="280">
              {nodes.map((nd) => (
                <line
                  key={`l-${nd.influencerId}`}
                  x1={nd.x}
                  y1={nd.y}
                  x2={cx}
                  y2={cy}
                  style={{ stroke: COLOR[nd.stance], strokeWidth: 3, opacity: 0.8 }}
                />
              ))}
              <circle cx={cx} cy={cy} r={38} style={{ fill: "var(--bg-primary)", stroke: "var(--accent)", strokeWidth: 2.5 }} />
              <text x={cx} y={cy - 2} textAnchor="middle" style={{ fill: "var(--text-primary)", fontSize: 15, fontWeight: 700 }}>
                ${c.symbol}
              </text>
              <text x={cx} y={cy + 15} textAnchor="middle" style={{ fill: "var(--text-secondary)", fontSize: 9 }}>
                ▲{c.bullish} ▼{c.bearish}
              </text>
              {nodes.map((nd) => (
                <g key={`n-${nd.influencerId}`}>
                  <circle cx={nd.x} cy={nd.y} r={20} style={{ fill: "var(--bg-primary)", stroke: COLOR[nd.stance], strokeWidth: 2 }} />
                  <text x={nd.x} y={nd.y + 4} textAnchor="middle" style={{ fontSize: 13 }}>
                    {nd.flipped ? "⇄" : stanceMeta(nd.stance).arrow}
                  </text>
                  <text x={nd.x} y={nd.y + 33} textAnchor="middle" style={{ fill: "var(--text-primary)", fontSize: 9 }}>
                    {(nd.displayName ?? nd.handle).slice(0, 10)}
                  </text>
                </g>
              ))}
            </svg>
          </div>

            <p className="legend-note">{t.consensus.legend}</p>
          </div>

          <div className="cols-split-right">
          {(debate.bull.length > 0 || debate.bear.length > 0) && (
            <>
              <div className="label-sm">{t.consensus.debateTitle}</div>
              <p className="debate-split">
                {debate.bull.length > 0 && debate.bear.length > 0
                  ? `${t.consensus.debateSplit}: ${debate.bull.length} ${t.stance.bullish} vs ${debate.bear.length} ${t.stance.bearish}`
                  : t.consensus.debateOneSided}
              </p>
              <div className="debate">
                <div className="debate-col bull">
                  <div className="debate-head up">▲ {t.consensus.bullCase}</div>
                  {debate.bull.length === 0 ? <p className="debate-empty">—</p> : debate.bull.map((d) => (
                    <Link key={`bull-${d.postId}`} href={`/p/${d.postId}`} className="debate-pt">
                      <b>{d.displayName ?? d.handle}</b>: {d.rationale}
                    </Link>
                  ))}
                </div>
                <div className="debate-col bear">
                  <div className="debate-head dn">▼ {t.consensus.bearCase}</div>
                  {debate.bear.length === 0 ? <p className="debate-empty">—</p> : debate.bear.map((d) => (
                    <Link key={`bear-${d.postId}`} href={`/p/${d.postId}`} className="debate-pt">
                      <b>{d.displayName ?? d.handle}</b>: {d.rationale}
                    </Link>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="label-sm">{t.consensus.latestStance}</div>
          <div className="feed">
            {c.stances.map((s) => (
              <div key={s.influencerId} className="dir-card">
                <div className="pc-av" style={{ width: "2rem", height: "2rem", fontSize: "0.85rem" }}>
                  {(s.displayName ?? s.handle).slice(0, 1).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Link href={`/i/${s.handle}`}>
                    <strong style={{ fontSize: "0.85rem" }}>{s.displayName ?? s.handle}</strong>
                  </Link>
                  {isNewsAccount(s.handle) && <span className="news-tag" title={t.influencer.newsAccountHint}>{t.influencer.newsAccount}</span>}
                  <div style={{ fontSize: "0.7rem", color: "var(--text-tertiary)" }}>{relativeTime(s.postedAt, locale)}</div>
                </div>
                <StanceBadge stance={s.stance} locale={locale} />
                {s.flipped && (
                  <span
                    className="badge"
                    style={{ background: "var(--bg-tertiary)", color: "var(--warning)", border: "1px solid var(--warning)" }}
                  >
                    ⇄ {s.prevStance && stanceMeta(s.prevStance, locale).text}→{stanceMeta(s.stance, locale).text}
                  </span>
                )}
              </div>
            ))}
          </div>
          </div>
        </div>
      )}
    </>
  );
}
