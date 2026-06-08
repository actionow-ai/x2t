"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "./LangProvider";
import type { Dict } from "@/lib/i18n";

type Inf = { id: string; handle: string; displayName: string | null; avatarUrl: string | null };
type Edge = { influencerId: string; symbol: string; stance: string; ts: number; flipped: boolean };

const STANCE_COLOR: Record<string, string> = {
  bullish: "var(--success)",
  bearish: "var(--error)",
  neutral: "var(--lime)",
};

// 时效性：边越新越粗越亮，越旧越淡
function recency(ts: number): { opacity: number; width: number } {
  const age = Date.now() - ts;
  const D = 86_400_000;
  if (age < D) return { opacity: 0.95, width: 4.5 };
  if (age < 7 * D) return { opacity: 0.72, width: 3.5 };
  if (age < 30 * D) return { opacity: 0.42, width: 2.5 };
  return { opacity: 0.2, width: 2 };
}

// 时间窗细粒度档位：天 → 小时 → 分钟（idx 0=全部，越大越窄）。label 用字典键。
const MIN = 60_000, HR = 3_600_000, DAY = 86_400_000;
const STOPS: { key: keyof Dict["graph"]; ms: number }[] = [
  { key: "winAll", ms: Number.POSITIVE_INFINITY },
  { key: "win30d", ms: 30 * DAY },
  { key: "win14d", ms: 14 * DAY },
  { key: "win7d", ms: 7 * DAY },
  { key: "win3d", ms: 3 * DAY },
  { key: "win48h", ms: 48 * HR },
  { key: "win24h", ms: 24 * HR },
  { key: "win12h", ms: 12 * HR },
  { key: "win6h", ms: 6 * HR },
  { key: "win3h", ms: 3 * HR },
  { key: "win1h", ms: HR },
  { key: "win30m", ms: 30 * MIN },
  { key: "win15m", ms: 15 * MIN },
];

export function GraphCanvas({ influencers, edges }: { influencers: Inf[]; edges: Edge[] }) {
  const router = useRouter();
  const t = useT();
  const [winIdx, setWinIdx] = useState(0);
  const [stance, setStance] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);

  const winMs = STOPS[winIdx].ms;

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
        <div className="graph-slider">
          <label className="slider-readout" htmlFor="win"><b>{t.graph[STOPS[winIdx].key]}</b> {fEdges.length} {t.graph.relationsWord}</label>
          <input
            id="win"
            type="range"
            min={0}
            max={STOPS.length - 1}
            step={1}
            value={winIdx}
            onChange={(e) => setWinIdx(Number(e.target.value))}
            aria-label={t.graph.winAll}
          />
          <div className="slider-ends"><span>{t.graph.winAll}</span><span>{t.graph.endNarrow}</span></div>
        </div>
        <div className="seg">
          <button className={`segbtn${stance === null ? " on" : ""}`} onClick={() => setStance(null)}>{t.graph.all}</button>
          <button className={`segbtn${stance === "bullish" ? " on" : ""}`} onClick={() => setStance("bullish")}>{t.stance.bullish}</button>
          <button className={`segbtn${stance === "bearish" ? " on" : ""}`} onClick={() => setStance("bearish")}>{t.stance.bearish}</button>
          <button className={`segbtn${stance === "neutral" ? " on" : ""}`} onClick={() => setStance("neutral")}>{t.stance.neutral}</button>
        </div>
        {pinned && (
          <button className="segbtn" onClick={() => setPinned(null)}>{t.graph.clearFocus} ✕</button>
        )}
      </div>

      {fEdges.length === 0 ? (
        <div className="empty">{t.graph.emptyFilter}</div>
      ) : (
        <div className="graph-frame">
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t.graph.title} style={{ width: "100%", minWidth: 660, height: "auto", display: "block" }}>
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

            <text x={leftX} y={26} textAnchor="middle" style={{ fill: "var(--text-tertiary)", fontSize: 11, fontWeight: 700, letterSpacing: 2 }}>{t.graph.infCol}</text>
            <text x={rightX} y={26} textAnchor="middle" style={{ fill: "var(--text-tertiary)", fontSize: 11, fontWeight: 700, letterSpacing: 2 }}>{t.graph.secCol}</text>

            {fEdges.map((e, i) => {
              const a = infPos.get(e.influencerId);
              const b = secPos.get(e.symbol);
              if (!a || !b) return null;
              const x1 = a.x + rInf, x2 = b.x - chipW / 2, mx = (x1 + x2) / 2;
              const on = edgeOn(e);
              const r = recency(e.ts);
              return (
                <path
                  key={i}
                  d={`M ${x1} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${x2} ${b.y}`}
                  fill="none"
                  stroke={STANCE_COLOR[e.stance]}
                  strokeWidth={on ? r.width : 2}
                  opacity={on ? r.opacity : 0.07}
                  strokeDasharray={e.flipped ? "9 5" : undefined}
                  strokeLinecap="round"
                />
              );
            })}

            {/* 转向标记：近期立场翻转的边 */}
            {fEdges.map((e, i) => {
              if (!e.flipped || !edgeOn(e)) return null;
              const a = infPos.get(e.influencerId);
              const b = secPos.get(e.symbol);
              if (!a || !b) return null;
              const mx = (a.x + rInf + b.x - chipW / 2) / 2, my = (a.y + b.y) / 2;
              return (
                <g key={`flip-${i}`} style={{ pointerEvents: "none" }}>
                  <circle cx={mx} cy={my} r={9.5} fill="var(--bg-secondary)" stroke="var(--blue)" strokeWidth={2} />
                  <text x={mx} y={my + 4} textAnchor="middle" style={{ fill: "var(--blue)", fontSize: 12, fontWeight: 800 }}>⇄</text>
                </g>
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
        <span className="badge bull">▲ {t.stance.bullish}</span>
        <span className="badge bear">▼ {t.stance.bearish}</span>
        <span className="badge neutral">— {t.stance.neutral}</span>
        <span className="hint" style={{ marginLeft: "auto" }}>{infList.length} {t.graph.influencersWord} · {secList.length} {t.graph.stocksWord} · {fEdges.length} {t.graph.relationsWord}</span>
      </div>
      <p className="hint" style={{ marginTop: "0.6rem" }}>{t.graph.hint}</p>
    </>
  );
}
