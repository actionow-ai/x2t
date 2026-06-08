import { getGraphData } from "@/lib/stance";
import Link from "next/link";

export const dynamic = "force-dynamic";

const COLOR: Record<string, string> = {
  bullish: "var(--success)",
  bearish: "var(--error)",
  neutral: "var(--text-tertiary)",
};

export default async function GraphPage() {
  const g = await getGraphData();

  const W = 600;
  const leftX = 120;
  const rightX = W - 120;
  const top = 44;
  const gap = 52;

  const infPos = new Map(g.influencers.map((inf, i) => [inf.id, { x: leftX, y: top + i * gap }]));
  const secPos = new Map(g.securities.map((s, i) => [s.symbol, { x: rightX, y: top + i * gap }]));
  const H = top + Math.max(g.influencers.length, g.securities.length, 1) * gap;

  return (
    <>
      <h1 className="page-title">关系图谱</h1>
      <p className="page-sub">博主 ↔ 股票（每对取最新立场）· 绿边看多 · 红边看空 · 灰边中性</p>

      {g.edges.length === 0 ? (
        <div className="empty">还没有分析数据。先 <code>pnpm analyze:once</code>。</div>
      ) : (
        <div className="post-card" style={{ padding: "0.5rem", overflowX: "auto" }}>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H}>
            {g.edges.map((e, i) => {
              const a = infPos.get(e.influencerId);
              const b = secPos.get(e.symbol);
              if (!a || !b) return null;
              return (
                <line
                  key={`e-${i}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  style={{ stroke: COLOR[e.stance], strokeWidth: 2, opacity: 0.7 }}
                />
              );
            })}

            {g.influencers.map((inf) => {
              const p = infPos.get(inf.id)!;
              return (
                <g key={`i-${inf.id}`}>
                  <circle cx={p.x} cy={p.y} r={16} style={{ fill: "var(--bg-primary)", stroke: "var(--accent)", strokeWidth: 2 }} />
                  <text x={p.x} y={p.y + 4} textAnchor="middle" style={{ fontSize: 11, fontWeight: 700 }}>
                    {(inf.displayName ?? inf.handle).slice(0, 1).toUpperCase()}
                  </text>
                  <text x={p.x - 24} y={p.y + 4} textAnchor="end" style={{ fill: "var(--text-primary)", fontSize: 11 }}>
                    {(inf.displayName ?? inf.handle).slice(0, 12)}
                  </text>
                </g>
              );
            })}

            {g.securities.map((s) => {
              const p = secPos.get(s.symbol)!;
              return (
                <g key={`s-${s.symbol}`}>
                  <circle cx={p.x} cy={p.y} r={18} style={{ fill: "var(--bg-primary)", stroke: "var(--text-secondary)", strokeWidth: 2 }} />
                  <text x={p.x} y={p.y + 4} textAnchor="middle" style={{ fill: "var(--text-primary)", fontSize: 10, fontWeight: 700 }}>
                    {s.symbol.slice(0, 5)}
                  </text>
                  <text x={p.x + 26} y={p.y + 4} textAnchor="start" style={{ fill: "var(--text-tertiary)", fontSize: 10 }}>
                    ${s.symbol}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}

      <p className="hint" style={{ marginTop: "0.8rem" }}>
        点股票看「谁在喊」共识：
        {g.securities.slice(0, 8).map((s) => (
          <Link key={s.symbol} href={`/t/${s.symbol}`} style={{ color: "var(--accent)", marginLeft: "0.5rem" }}>
            ${s.symbol}
          </Link>
        ))}
      </p>
    </>
  );
}
