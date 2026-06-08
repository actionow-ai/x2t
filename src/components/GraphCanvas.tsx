"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { forceSimulation, forceLink, forceManyBody, forceCollide, forceX, forceY } from "d3-force";
import { useT } from "./LangProvider";
import type { Dict } from "@/lib/i18n";

type Inf = { id: string; handle: string; displayName: string | null; avatarUrl: string | null };
type Edge = { influencerId: string; symbol: string; stance: string; ts: number; flipped: boolean };

type GNode = {
  id: string;
  kind: "inf" | "sec";
  label: string;
  avatarUrl?: string | null;
  count: number;
  x?: number;
  y?: number;
};
type GLink = { source: string | GNode; target: string | GNode; stance: string; flipped: boolean; ts: number };

const STANCE_COLOR: Record<string, string> = {
  bullish: "var(--success)",
  bearish: "var(--error)",
  neutral: "var(--lime)",
};

// 时效性：边越新越粗越亮，越旧越淡
function recency(ts: number): { opacity: number; width: number } {
  const age = Date.now() - ts;
  const D = 86_400_000;
  if (age < D) return { opacity: 0.95, width: 4 };
  if (age < 7 * D) return { opacity: 0.7, width: 3 };
  if (age < 30 * D) return { opacity: 0.42, width: 2.25 };
  return { opacity: 0.2, width: 1.75 };
}

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

const R_INF = 24; // 博主头像半径
const CHIP_W = 92, CHIP_H = 34; // 股票 chip

export function GraphCanvas({ influencers, edges }: { influencers: Inf[]; edges: Edge[] }) {
  const router = useRouter();
  const t = useT();
  const [winIdx, setWinIdx] = useState(0);
  const [stance, setStance] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []); // 力导向 + 时效依赖客户端，避免 SSR/hydration 不匹配

  const winMs = STOPS[winIdx].ms;

  const fEdges = useMemo(() => {
    const now = Date.now();
    return edges.filter((e) => now - e.ts <= winMs && (!stance || e.stance === stance));
  }, [edges, winMs, stance]);

  // 力导向布局：构建节点/连线 → 跑模拟到收敛 → 计算 viewBox
  const { nodes, links, vb } = useMemo(() => {
    const infById = new Map(influencers.map((i) => [i.id, i]));
    const infCount = new Map<string, number>();
    const secCount = new Map<string, number>();
    for (const e of fEdges) {
      infCount.set(e.influencerId, (infCount.get(e.influencerId) ?? 0) + 1);
      secCount.set(e.symbol, (secCount.get(e.symbol) ?? 0) + 1);
    }
    const nodes: GNode[] = [];
    for (const [id, count] of infCount) {
      const inf = infById.get(id);
      nodes.push({ id, kind: "inf", label: inf?.displayName ?? inf?.handle ?? id, avatarUrl: inf?.avatarUrl, count });
    }
    for (const [symbol, count] of secCount) {
      nodes.push({ id: symbol, kind: "sec", label: symbol, count });
    }
    const links: GLink[] = fEdges.map((e) => ({ source: e.influencerId, target: e.symbol, stance: e.stance, flipped: e.flipped, ts: e.ts }));

    // 确定性初始位置（避免每次渲染抖动）：环形铺开
    const n = Math.max(nodes.length, 1);
    nodes.forEach((nd, i) => {
      const ang = (2 * Math.PI * i) / n;
      const rad = 60 + (nd.kind === "sec" ? 120 : 40);
      nd.x = rad * Math.cos(ang);
      nd.y = rad * Math.sin(ang);
    });

    const sim = forceSimulation(nodes as never[])
      .force("link", forceLink(links as never[]).id((d) => (d as GNode).id).distance(96).strength(0.45))
      .force("charge", forceManyBody().strength(-340))
      .force("collide", forceCollide<GNode>((d) => (d.kind === "inf" ? R_INF + 16 : CHIP_W / 2 + 8)))
      .force("x", forceX(0).strength(0.07))
      .force("y", forceY(0).strength(0.09))
      .stop();
    for (let i = 0; i < 340; i++) sim.tick();

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const nd of nodes) {
      const halfW = nd.kind === "inf" ? R_INF : CHIP_W / 2;
      const halfH = nd.kind === "inf" ? R_INF : CHIP_H / 2;
      minX = Math.min(minX, (nd.x ?? 0) - halfW - 70); // 左侧留名字空间
      maxX = Math.max(maxX, (nd.x ?? 0) + halfW + 40);
      minY = Math.min(minY, (nd.y ?? 0) - halfH - 16);
      maxY = Math.max(maxY, (nd.y ?? 0) + halfH + 16);
    }
    if (!nodes.length) { minX = -100; minY = -100; maxX = 100; maxY = 100; }
    const pad = 24;
    const vb = { x: minX - pad, y: minY - pad, w: maxX - minX + 2 * pad, h: maxY - minY + 2 * pad };
    return { nodes, links, vb };
  }, [fEdges, influencers]);

  const infCountN = nodes.filter((n) => n.kind === "inf").length;
  const secCountN = nodes.filter((n) => n.kind === "sec").length;

  const focus = pinned ?? hover;
  const neighbors = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const l of links) {
      const s = typeof l.source === "string" ? l.source : l.source.id;
      const tg = typeof l.target === "string" ? l.target : l.target.id;
      if (!m.has(s)) m.set(s, new Set());
      if (!m.has(tg)) m.set(tg, new Set());
      m.get(s)!.add(tg);
      m.get(tg)!.add(s);
    }
    return m;
  }, [links]);
  const connected = (id: string) => !focus || id === focus || !!neighbors.get(focus)?.has(id);
  const linkOn = (l: GLink) => {
    if (!focus) return true;
    const s = typeof l.source === "string" ? l.source : l.source.id;
    const tg = typeof l.target === "string" ? l.target : l.target.id;
    return s === focus || tg === focus;
  };
  const nid = (x: string | GNode) => (typeof x === "string" ? x : x.id);

  return (
    <>
      <div className="graph-controls">
        <div className="graph-slider">
          <label className="slider-readout" htmlFor="win"><b>{t.graph[STOPS[winIdx].key]}</b> {fEdges.length} {t.graph.relationsWord}</label>
          <input id="win" type="range" min={0} max={STOPS.length - 1} step={1} value={winIdx} onChange={(e) => setWinIdx(Number(e.target.value))} aria-label={t.graph.winAll} />
          <div className="slider-ends"><span>{t.graph.winAll}</span><span>{t.graph.endNarrow}</span></div>
        </div>
        <div className="seg">
          <button className={`segbtn${stance === null ? " on" : ""}`} onClick={() => setStance(null)}>{t.graph.all}</button>
          <button className={`segbtn${stance === "bullish" ? " on" : ""}`} onClick={() => setStance("bullish")}>{t.stance.bullish}</button>
          <button className={`segbtn${stance === "bearish" ? " on" : ""}`} onClick={() => setStance("bearish")}>{t.stance.bearish}</button>
          <button className={`segbtn${stance === "neutral" ? " on" : ""}`} onClick={() => setStance("neutral")}>{t.stance.neutral}</button>
        </div>
        {pinned && <button className="segbtn" onClick={() => setPinned(null)}>{t.graph.clearFocus} ✕</button>}
      </div>

      {fEdges.length === 0 ? (
        <div className="empty">{t.graph.emptyFilter}</div>
      ) : !mounted ? (
        <div className="graph-frame" style={{ minHeight: "40vh" }} />
      ) : (
        <div className="graph-frame">
          <svg viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} role="img" aria-label={t.graph.title} style={{ width: "100%", height: "auto", maxHeight: "78vh", display: "block" }}>
            <defs>
              {nodes.filter((n) => n.kind === "inf" && n.avatarUrl).map((n) => (
                <clipPath id={`gc-${n.id}`} key={n.id}>
                  <circle cx={n.x} cy={n.y} r={R_INF} />
                </clipPath>
              ))}
            </defs>

            {/* 边 */}
            {links.map((l, i) => {
              const a = l.source as GNode, b = l.target as GNode;
              if (typeof a === "string" || typeof b === "string") return null;
              const on = linkOn(l);
              const r = recency(l.ts);
              return (
                <line
                  key={i}
                  x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  stroke={STANCE_COLOR[l.stance]}
                  strokeWidth={on ? r.width : 1.5}
                  opacity={on ? r.opacity : 0.06}
                  strokeDasharray={l.flipped ? "8 5" : undefined}
                  strokeLinecap="round"
                />
              );
            })}

            {/* 转向标记 */}
            {links.map((l, i) => {
              if (!l.flipped || !linkOn(l)) return null;
              const a = l.source as GNode, b = l.target as GNode;
              if (typeof a === "string" || typeof b === "string") return null;
              const mx = ((a.x ?? 0) + (b.x ?? 0)) / 2, my = ((a.y ?? 0) + (b.y ?? 0)) / 2;
              return (
                <g key={`f-${i}`} style={{ pointerEvents: "none" }}>
                  <circle cx={mx} cy={my} r={9} fill="var(--bg-secondary)" stroke="var(--blue)" strokeWidth={2} />
                  <text x={mx} y={my + 4} textAnchor="middle" style={{ fill: "var(--blue)", fontSize: 11, fontWeight: 800 }}>⇄</text>
                </g>
              );
            })}

            {/* 节点 */}
            {nodes.map((n) => {
              const dim = !connected(n.id);
              const sel = focus === n.id;
              if (n.kind === "inf") {
                return (
                  <g key={n.id} style={{ cursor: "pointer", opacity: dim ? 0.2 : 1, transition: "opacity .15s" }}
                    onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover(null)}
                    onClick={() => setPinned(pinned === n.id ? null : n.id)}>
                    <circle cx={(n.x ?? 0) + 3} cy={(n.y ?? 0) + 3} r={R_INF} fill="var(--ink)" />
                    <circle cx={n.x} cy={n.y} r={R_INF} fill="var(--bg-secondary)" stroke={sel ? "var(--blue)" : "var(--ink)"} strokeWidth={sel ? 4 : 3} />
                    {n.avatarUrl ? (
                      <image href={n.avatarUrl} x={(n.x ?? 0) - R_INF} y={(n.y ?? 0) - R_INF} width={R_INF * 2} height={R_INF * 2} clipPath={`url(#gc-${n.id})`} preserveAspectRatio="xMidYMid slice" />
                    ) : (
                      <text x={n.x} y={(n.y ?? 0) + 5} textAnchor="middle" style={{ fill: "var(--ink)", fontSize: 15, fontWeight: 700 }}>{n.label.slice(0, 1).toUpperCase()}</text>
                    )}
                    <text x={n.x} y={(n.y ?? 0) + R_INF + 13} textAnchor="middle" style={{ fill: "var(--ink)", fontSize: 11, fontWeight: 700 }}>{n.label.slice(0, 14)}</text>
                  </g>
                );
              }
              return (
                <g key={n.id} style={{ cursor: "pointer", opacity: dim ? 0.2 : 1, transition: "opacity .15s" }}
                  onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover(null)}
                  onClick={() => router.push(`/t/${n.id}`)}>
                  <rect x={(n.x ?? 0) - CHIP_W / 2 + 3} y={(n.y ?? 0) - CHIP_H / 2 + 3} width={CHIP_W} height={CHIP_H} rx={3} fill="var(--ink)" />
                  <rect x={(n.x ?? 0) - CHIP_W / 2} y={(n.y ?? 0) - CHIP_H / 2} width={CHIP_W} height={CHIP_H} rx={3} fill="var(--bg-secondary)" stroke={sel ? "var(--blue)" : "var(--ink)"} strokeWidth={sel ? 4 : 3} />
                  <text x={n.x} y={(n.y ?? 0) + 5} textAnchor="middle" style={{ fill: "var(--ink)", fontSize: 13, fontWeight: 700 }}>${n.label} <tspan style={{ fill: "var(--text-tertiary)", fontSize: 10 }}>×{n.count}</tspan></text>
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
        <span className="hint" style={{ marginLeft: "auto" }}>{infCountN} {t.graph.influencersWord} · {secCountN} {t.graph.stocksWord} · {fEdges.length} {t.graph.relationsWord}</span>
      </div>
      <p className="hint" style={{ marginTop: "0.6rem" }}>{t.graph.hint}</p>
    </>
  );
}
