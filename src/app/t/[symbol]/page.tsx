import { getStockConsensus } from "@/lib/stance";
import { StanceBadge, stanceMeta } from "@/components/StanceBadge";
import { relativeTime } from "@/lib/time";
import Link from "next/link";

export const dynamic = "force-dynamic";

const COLOR: Record<string, string> = {
  bullish: "var(--success)",
  bearish: "var(--error)",
  neutral: "var(--text-tertiary)",
};

export default async function StockPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const c = await getStockConsensus(symbol);

  const cx = 170;
  const cy = 150;
  const R = 110;
  const n = c.stances.length;
  const nodes = c.stances.map((s, i) => {
    const angle = n === 1 ? -Math.PI / 2 : (2 * Math.PI * i) / n - Math.PI / 2;
    return { ...s, x: cx + R * Math.cos(angle), y: cy + R * Math.sin(angle) };
  });

  const overall = c.bullish > c.bearish ? "bullish" : c.bearish > c.bullish ? "bearish" : "neutral";

  return (
    <>
      <h1 className="page-title">
        ${c.symbol}
        {c.name && (
          <span style={{ fontSize: "0.9rem", color: "var(--text-secondary)", fontWeight: 400 }}> · {c.name}</span>
        )}
      </h1>
      <p className="page-sub">
        谁在聊 ${c.symbol} · 共识{" "}
        <StanceBadge stance={overall} label={`▲${c.bullish} ▼${c.bearish} —${c.neutral}`} />
      </p>

      {n === 0 ? (
        <div className="empty">还没有博主点评 ${c.symbol}。</div>
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
                {c.bullish}多·{c.bearish}空
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

          <div className="label-sm">博主立场（每人最新）</div>
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
                  <div style={{ fontSize: "0.7rem", color: "var(--text-tertiary)" }}>{relativeTime(s.postedAt)}</div>
                </div>
                <StanceBadge stance={s.stance} />
                {s.flipped && (
                  <span
                    className="badge"
                    style={{ background: "var(--bg-tertiary)", color: "var(--warning)", border: "1px solid var(--warning)" }}
                  >
                    ⇄ {s.prevStance && stanceMeta(s.prevStance).text}→{stanceMeta(s.stance).text}
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
