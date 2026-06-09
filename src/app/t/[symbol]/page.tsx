import { getStockConsensus, getStockDebate } from "@/lib/stance";
import { isNewsAccount } from "@/lib/account";
import { StanceBadge, stanceMeta } from "@/components/StanceBadge";
import { relativeTime } from "@/lib/time";
import { getLocale } from "@/lib/i18n-server";
import { getDict } from "@/lib/i18n";
import Link from "next/link";

export const dynamic = "force-dynamic";

const COLOR: Record<string, string> = {
  bullish: "var(--success)",
  bearish: "var(--error)",
  neutral: "var(--text-tertiary)",
};

export default async function StockPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const locale = await getLocale();
  const t = getDict(locale);
  const c = await getStockConsensus(symbol);
  const debate = await getStockDebate(symbol, locale === "en" ? "en" : "zh");

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

      {n === 0 ? (
        <div className="empty">{t.consensus.noOne} ${c.symbol}。</div>
      ) : (
        <>
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

          {(debate.bull.length > 0 || debate.bear.length > 0) && (
            <>
              <div className="label-sm">{t.consensus.debateTitle}</div>
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
                  {isNewsAccount(s.handle) && <span className="news-tag" title={t.consensus.methodNote}>{t.influencer.newsAccount}</span>}
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
        </>
      )}
    </>
  );
}
