import { getGraphData } from "@/lib/stance";
import Link from "next/link";

export const dynamic = "force-dynamic";

const STANCE_COLOR: Record<string, string> = {
  bullish: "var(--success)",
  bearish: "var(--error)",
  neutral: "var(--lime)",
};

export default async function GraphPage() {
  const g = await getGraphData();

  const W = 1000;
  const leftX = 158;
  const rightX = 842;
  const top = 56;
  const gap = 76;
  const rInf = 25;
  const chipW = 96;
  const chipH = 40;

  const rows = Math.max(g.influencers.length, g.securities.length, 1);
  const H = top + rows * gap;
  const infOffset = ((rows - g.influencers.length) * gap) / 2;
  const secOffset = ((rows - g.securities.length) * gap) / 2;

  const infPos = new Map(g.influencers.map((inf, i) => [inf.id, { x: leftX, y: top + infOffset + i * gap }]));
  const secPos = new Map(g.securities.map((s, i) => [s.symbol, { x: rightX, y: top + secOffset + i * gap }]));

  return (
    <>
      <h1 className="page-title">关系图谱</h1>
      <p className="page-sub">博主 ↔ 股票（每对取最新立场） · 绿=看多 红=看空 黄=中性</p>

      {g.edges.length === 0 ? (
        <div className="empty">
          还没有分析数据。<br />先 <code>pnpm analyze:once</code> 生成立场。
        </div>
      ) : (
        <>
          <div className="graph-frame">
            <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="博主与股票关系图谱" style={{ width: "100%", minWidth: 660, height: "auto", display: "block" }}>
              <defs>
                {g.influencers
                  .filter((inf) => inf.avatarUrl)
                  .map((inf) => {
                    const p = infPos.get(inf.id)!;
                    return (
                      <clipPath id={`clip-${inf.id}`} key={inf.id}>
                        <circle cx={p.x} cy={p.y} r={rInf} />
                      </clipPath>
                    );
                  })}
              </defs>

              {/* 列标题 */}
              <text x={leftX} y={26} textAnchor="middle" style={{ fill: "var(--text-tertiary)", fontSize: 11, fontWeight: 700, letterSpacing: 2 }}>博主</text>
              <text x={rightX} y={26} textAnchor="middle" style={{ fill: "var(--text-tertiary)", fontSize: 11, fontWeight: 700, letterSpacing: 2 }}>股票</text>

              {/* 边 */}
              {g.edges.map((e, i) => {
                const a = infPos.get(e.influencerId);
                const b = secPos.get(e.symbol);
                if (!a || !b) return null;
                const x1 = a.x + rInf;
                const x2 = b.x - chipW / 2;
                const mx = (x1 + x2) / 2;
                return (
                  <path
                    key={i}
                    d={`M ${x1} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${x2} ${b.y}`}
                    fill="none"
                    stroke={STANCE_COLOR[e.stance]}
                    strokeWidth={3.5}
                    strokeLinecap="round"
                    opacity={0.85}
                  />
                );
              })}

              {/* 博主节点（头像 + 硬阴影） */}
              {g.influencers.map((inf) => {
                const p = infPos.get(inf.id)!;
                const name = inf.displayName ?? inf.handle;
                return (
                  <g key={inf.id}>
                    <circle cx={p.x + 4} cy={p.y + 4} r={rInf} fill="var(--ink)" />
                    <circle cx={p.x} cy={p.y} r={rInf} fill="var(--bg-secondary)" stroke="var(--ink)" strokeWidth={3} />
                    {inf.avatarUrl ? (
                      <image
                        href={inf.avatarUrl}
                        x={p.x - rInf}
                        y={p.y - rInf}
                        width={rInf * 2}
                        height={rInf * 2}
                        clipPath={`url(#clip-${inf.id})`}
                        preserveAspectRatio="xMidYMid slice"
                      />
                    ) : (
                      <text x={p.x} y={p.y + 5} textAnchor="middle" style={{ fill: "var(--ink)", fontSize: 15, fontWeight: 700 }}>
                        {name.slice(0, 1).toUpperCase()}
                      </text>
                    )}
                    <text x={p.x - rInf - 12} y={p.y + 4} textAnchor="end" style={{ fill: "var(--ink)", fontSize: 12.5, fontWeight: 700 }}>
                      {name.slice(0, 14)}
                    </text>
                  </g>
                );
              })}

              {/* 股票节点（贴纸 + 硬阴影） */}
              {g.securities.map((s) => {
                const p = secPos.get(s.symbol)!;
                return (
                  <g key={s.symbol}>
                    <rect x={p.x - chipW / 2 + 4} y={p.y - chipH / 2 + 4} width={chipW} height={chipH} rx={3} fill="var(--ink)" />
                    <rect x={p.x - chipW / 2} y={p.y - chipH / 2} width={chipW} height={chipH} rx={3} fill="var(--bg-secondary)" stroke="var(--ink)" strokeWidth={3} />
                    <text x={p.x} y={p.y + 5} textAnchor="middle" style={{ fill: "var(--ink)", fontSize: 14, fontWeight: 700 }}>
                      ${s.symbol}
                    </text>
                    <text x={p.x + chipW / 2 + 12} y={p.y + 4} textAnchor="start" style={{ fill: "var(--text-tertiary)", fontSize: 11, fontWeight: 700 }}>
                      ×{s.count}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="graph-legend">
            <span className="badge bull">▲ 看多</span>
            <span className="badge bear">▼ 看空</span>
            <span className="badge neutral">— 中性</span>
            <span className="hint" style={{ marginLeft: "auto" }}>{g.influencers.length} 博主 · {g.securities.length} 股票 · {g.edges.length} 关系</span>
          </div>

          <p className="hint" style={{ marginTop: "0.7rem" }}>
            点股票看「谁在喊」共识：
            {g.securities.slice(0, 10).map((s) => (
              <Link key={s.symbol} href={`/t/${s.symbol}`} style={{ color: "var(--blue)", marginLeft: "0.55rem" }}>
                ${s.symbol}
              </Link>
            ))}
          </p>
        </>
      )}
    </>
  );
}
