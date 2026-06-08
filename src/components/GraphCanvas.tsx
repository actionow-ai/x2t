"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Inf = { id: string; handle: string; displayName: string | null; avatarUrl: string | null };
type Edge = { influencerId: string; symbol: string; stance: string; ts: number };

const STANCE_COLOR: Record<string, string> = {
  bullish: "var(--success)",
  bearish: "var(--error)",
  neutral: "var(--lime)",
};

const WINDOWS = [
  { k: "all", label: "全部", ms: Number.POSITIVE_INFINITY },
  { k: "7d", label: "近7天", ms: 7 * 86_400_000 },
  { k: "24h", label: "近24h", ms: 86_400_000 },
];

export function GraphCanvas({ influencers, edges }: { influencers: Inf[]; edges: Edge[] }) {
  const router = useRouter();
  const [win, setWin] = useState("all");
  const [stance, setStance] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);

  const winMs = WINDOWS.find((w) => w.k === win)!.ms;

  const fEdges = useMemo(() => {
    const now = Date.now();
    return edges.filter((e) => now - e.ts <= winMs && (!stance || e.stance === stance));
  }, [edges, winMs, stance]);

  const { infList, secList } = useMemo(() => {
    const infCount = new Map<string, number>();
    const secCount = new Map<string, number>();
    for (const e of fEdges) {
      infCount.set(e.influencerId, (infCount.get(e.influencerId) ?? 0) + 1);
      secCount.set(e.symbol, (secCount.get(e.symbol) ?? 0) + 1);
    }
    const infList = influencers
      .filter((i) => infCount.has(i.id))
      .map((i) => ({ ...i, count: infCount.get(i.id)! }))
      .sort((a, b) => b.count - a.count);
    const secList = [...secCount.entries()]
      .map(([symbol, count]) => ({ symbol, count }))
      .sort((a, b) => b.count - a.count);
    return { infList, secList };
  }, [fEdges, influencers]);

  // layout
  const W = 1000, leftX = 158, rightX = 842, top = 56, gap = 76, rInf = 25, chipW = 96, chipH = 40;
  const rowsN = Math.max(infList.length, secList.length, 1);
  const H = top + rowsN * gap;
  const infOff = ((rowsN - infList.length) * gap) / 2;
  const secOff = ((rowsN - secList.length) * gap) / 2;
  const infPos = new Map(infList.map((i, idx) => [i.id, { x: leftX, y: top + infOff + idx * gap }]));
  const secPos = new Map(secList.map((s, idx) => [s.symbol, { x: rightX, y: top + secOff + idx * gap }]));

  const focus = pinned ?? hover;
  const connected = (id: string) =>
    !focus || id === focus || fEdges.some((e) => (e.influencerId === focus || e.symbol === focus) && (e.influencerId === id || e.symbol === id));
  const edgeOn = (e: Edge) => !focus || e.influencerId === focus || e.symbol === focus;

  return (
    <>
      <div className="graph-controls">
        <div className="seg">
          {WINDOWS.map((w) => (
            <button key={w.k} className={`segbtn${win === w.k ? " on" : ""}`} onClick={() => setWin(w.k)}>{w.label}</button>
          ))}
        </div>
        <div className="seg">
          <button className={`segbtn${stance === null ? " on" : ""}`} onClick={() => setStance(null)}>全部</button>
          <button className={`segbtn${stance === "bullish" ? " on" : ""}`} onClick={() => setStance("bullish")}>看多</button>
          <button className={`segbtn${stance === "bearish" ? " on" : ""}`} onClick={() => setStance("bearish")}>看空</button>
          <button className={`segbtn${stance === "neutral" ? " on" : ""}`} onClick={() => setStance("neutral")}>中性</button>
        </div>
        {pinned && (
          <button className="segbtn" onClick={() => setPinned(null)}>清除聚焦 ✕</button>
        )}
      </div>

      {fEdges.length === 0 ? (
        <div className="empty">该筛选条件下没有关系。</div>
      ) : (
        <div className="graph-frame">
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="关系图谱" style={{ width: "100%", minWidth: 660, height: "auto", display: "block" }}>
            <defs>
              {infList.filter((i) => i.avatarUrl).map((i) => {
                const p = infPos.get(i.id)!;
                return (
                  <clipPath id={`gc-${i.id}`} key={i.id}>
                    <circle cx={p.x} cy={p.y} r={rInf} />
                  </clipPath>
                );
              })}
            </defs>

            <text x={leftX} y={26} textAnchor="middle" style={{ fill: "var(--text-tertiary)", fontSize: 11, fontWeight: 700, letterSpacing: 2 }}>博主</text>
            <text x={rightX} y={26} textAnchor="middle" style={{ fill: "var(--text-tertiary)", fontSize: 11, fontWeight: 700, letterSpacing: 2 }}>股票</text>

            {fEdges.map((e, i) => {
              const a = infPos.get(e.influencerId);
              const b = secPos.get(e.symbol);
              if (!a || !b) return null;
              const x1 = a.x + rInf, x2 = b.x - chipW / 2, mx = (x1 + x2) / 2;
              const on = edgeOn(e);
              return (
                <path
                  key={i}
                  d={`M ${x1} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${x2} ${b.y}`}
                  fill="none"
                  stroke={STANCE_COLOR[e.stance]}
                  strokeWidth={on ? 4 : 2.5}
                  opacity={on ? 0.9 : 0.1}
                  strokeLinecap="round"
                />
              );
            })}

            {infList.map((i) => {
              const p = infPos.get(i.id)!;
              const name = i.displayName ?? i.handle;
              const dim = !connected(i.id);
              const sel = focus === i.id;
              return (
                <g
                  key={i.id}
                  style={{ cursor: "pointer", opacity: dim ? 0.22 : 1, transition: "opacity .15s" }}
                  onMouseEnter={() => setHover(i.id)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => setPinned(pinned === i.id ? null : i.id)}
                >
                  <circle cx={p.x + 4} cy={p.y + 4} r={rInf} fill="var(--ink)" />
                  <circle cx={p.x} cy={p.y} r={rInf} fill="var(--bg-secondary)" stroke={sel ? "var(--blue)" : "var(--ink)"} strokeWidth={sel ? 4 : 3} />
                  {i.avatarUrl ? (
                    <image href={i.avatarUrl} x={p.x - rInf} y={p.y - rInf} width={rInf * 2} height={rInf * 2} clipPath={`url(#gc-${i.id})`} preserveAspectRatio="xMidYMid slice" />
                  ) : (
                    <text x={p.x} y={p.y + 5} textAnchor="middle" style={{ fill: "var(--ink)", fontSize: 15, fontWeight: 700 }}>{name.slice(0, 1).toUpperCase()}</text>
                  )}
                  <text x={p.x - rInf - 12} y={p.y + 4} textAnchor="end" style={{ fill: "var(--ink)", fontSize: 12.5, fontWeight: 700 }}>{name.slice(0, 14)}</text>
                </g>
              );
            })}

            {secList.map((s) => {
              const p = secPos.get(s.symbol)!;
              const dim = !connected(s.symbol);
              const sel = focus === s.symbol;
              return (
                <g
                  key={s.symbol}
                  style={{ cursor: "pointer", opacity: dim ? 0.22 : 1, transition: "opacity .15s" }}
                  onMouseEnter={() => setHover(s.symbol)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => router.push(`/t/${s.symbol}`)}
                >
                  <rect x={p.x - chipW / 2 + 4} y={p.y - chipH / 2 + 4} width={chipW} height={chipH} rx={3} fill="var(--ink)" />
                  <rect x={p.x - chipW / 2} y={p.y - chipH / 2} width={chipW} height={chipH} rx={3} fill="var(--bg-secondary)" stroke={sel ? "var(--blue)" : "var(--ink)"} strokeWidth={sel ? 4 : 3} />
                  <text x={p.x} y={p.y + 5} textAnchor="middle" style={{ fill: "var(--ink)", fontSize: 14, fontWeight: 700 }}>${s.symbol}</text>
                  <text x={p.x + chipW / 2 + 12} y={p.y + 4} textAnchor="start" style={{ fill: "var(--text-tertiary)", fontSize: 11, fontWeight: 700 }}>×{s.count}</text>
                </g>
              );
            })}
          </svg>
        </div>
      )}

      <div className="graph-legend">
        <span className="badge bull">▲ 看多</span>
        <span className="badge bear">▼ 看空</span>
        <span className="badge neutral">— 中性</span>
        <span className="hint" style={{ marginLeft: "auto" }}>{infList.length} 博主 · {secList.length} 股票 · {fEdges.length} 关系</span>
      </div>
      <p className="hint" style={{ marginTop: "0.6rem" }}>悬停高亮关联 · 点博主锁定聚焦 · 点股票看共识</p>
    </>
  );
}
