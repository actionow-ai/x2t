"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { forceSimulation, forceLink, forceManyBody, forceCollide, forceX, forceY } from "d3-force";
import { useT, useLocale } from "./LangProvider";
import type { Dict } from "@/lib/i18n";

type Inf = { id: string; handle: string; displayName: string | null; avatarUrl: string | null };
type Edge = {
  influencerId: string;
  symbol: string;
  stance: string;
  ts: number;
  flipped: boolean;
  postId: string;
  snippet: string;
  snippetZh: string | null;
  snippetEn: string | null;
};
type GNode = { id: string; kind: "inf" | "sec"; label: string; avatarUrl?: string | null; count: number; x?: number; y?: number };
type GLink = { source: string | GNode; target: string | GNode; stance: string; flipped: boolean; ts: number };

const STANCE_COLOR: Record<string, string> = { bullish: "var(--success)", bearish: "var(--error)", neutral: "var(--lime)" };

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
  { key: "winAll", ms: Number.POSITIVE_INFINITY }, { key: "win30d", ms: 30 * DAY }, { key: "win14d", ms: 14 * DAY },
  { key: "win7d", ms: 7 * DAY }, { key: "win3d", ms: 3 * DAY }, { key: "win48h", ms: 48 * HR }, { key: "win24h", ms: 24 * HR },
  { key: "win12h", ms: 12 * HR }, { key: "win6h", ms: 6 * HR }, { key: "win3h", ms: 3 * HR }, { key: "win1h", ms: HR },
  { key: "win30m", ms: 30 * MIN }, { key: "win15m", ms: 15 * MIN },
];

const R_INF = 26, CHIP_W = 94, CHIP_H = 36;

export function GraphCanvas({ influencers, edges }: { influencers: Inf[]; edges: Edge[] }) {
  const router = useRouter();
  const t = useT();
  const locale = useLocale();
  const [winIdx, setWinIdx] = useState(0);
  const [stance, setStance] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [fs, setFs] = useState(false);
  const [drag, setDrag] = useState<Record<string, { x: number; y: number }>>({});
  const frameRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragState = useRef<{ id: string; moved: boolean } | null>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const h = () => setFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", h);
    return () => document.removeEventListener("fullscreenchange", h);
  }, []);

  const winMs = STOPS[winIdx].ms;
  const fEdges = useMemo(() => {
    const now = Date.now();
    return edges.filter((e) => now - e.ts <= winMs && (!stance || e.stance === stance));
  }, [edges, winMs, stance]);

  const { nodes, basePos, vb } = useMemo(() => {
    const infById = new Map(influencers.map((i) => [i.id, i]));
    const infCount = new Map<string, number>(), secCount = new Map<string, number>();
    for (const e of fEdges) {
      infCount.set(e.influencerId, (infCount.get(e.influencerId) ?? 0) + 1);
      secCount.set(e.symbol, (secCount.get(e.symbol) ?? 0) + 1);
    }
    const nodes: GNode[] = [];
    for (const [id, count] of infCount) {
      const inf = infById.get(id);
      nodes.push({ id, kind: "inf", label: inf?.displayName ?? inf?.handle ?? id, avatarUrl: inf?.avatarUrl, count });
    }
    for (const [symbol, count] of secCount) nodes.push({ id: symbol, kind: "sec", label: symbol, count });
    const links: GLink[] = fEdges.map((e) => ({ source: e.influencerId, target: e.symbol, stance: e.stance, flipped: e.flipped, ts: e.ts }));

    const n = Math.max(nodes.length, 1);
    nodes.forEach((nd, i) => {
      const ang = (2 * Math.PI * i) / n;
      const rad = 60 + (nd.kind === "sec" ? 130 : 40);
      nd.x = rad * Math.cos(ang); nd.y = rad * Math.sin(ang);
    });
    const sim = forceSimulation(nodes as never[])
      .force("link", forceLink(links as never[]).id((d) => (d as GNode).id).distance(104).strength(0.45))
      .force("charge", forceManyBody().strength(-380))
      .force("collide", forceCollide<GNode>((d) => (d.kind === "inf" ? R_INF + 18 : CHIP_W / 2 + 10)))
      .force("x", forceX(0).strength(0.06)).force("y", forceY(0).strength(0.08))
      .stop();
    for (let i = 0; i < 360; i++) sim.tick();

    const basePos = new Map<string, { x: number; y: number }>();
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const nd of nodes) {
      basePos.set(nd.id, { x: nd.x ?? 0, y: nd.y ?? 0 });
      const hw = nd.kind === "inf" ? R_INF + 70 : CHIP_W / 2 + 30, hh = (nd.kind === "inf" ? R_INF + 18 : CHIP_H / 2 + 14);
      minX = Math.min(minX, (nd.x ?? 0) - hw); maxX = Math.max(maxX, (nd.x ?? 0) + hw);
      minY = Math.min(minY, (nd.y ?? 0) - hh); maxY = Math.max(maxY, (nd.y ?? 0) + hh);
    }
    if (!nodes.length) { minX = minY = -100; maxX = maxY = 100; }
    const pad = 20;
    return { nodes, basePos, vb: { x: minX - pad, y: minY - pad, w: maxX - minX + 2 * pad, h: maxY - minY + 2 * pad } };
  }, [fEdges, influencers]);

  useEffect(() => { setDrag({}); setSel(null); }, [winIdx, stance]);

  const pos = (id: string) => drag[id] ?? basePos.get(id) ?? { x: 0, y: 0 };
  const infCountN = nodes.filter((n) => n.kind === "inf").length;
  const secCountN = nodes.filter((n) => n.kind === "sec").length;

  const focus = pinned ?? hover ?? sel;
  const neighbors = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const e of fEdges) {
      if (!m.has(e.influencerId)) m.set(e.influencerId, new Set());
      if (!m.has(e.symbol)) m.set(e.symbol, new Set());
      m.get(e.influencerId)!.add(e.symbol); m.get(e.symbol)!.add(e.influencerId);
    }
    return m;
  }, [fEdges]);
  const connected = (id: string) => !focus || id === focus || !!neighbors.get(focus)?.has(id);
  const linkOn = (l: GLink) => {
    if (!focus) return true;
    const s = typeof l.source === "string" ? l.source : l.source.id;
    const tg = typeof l.target === "string" ? l.target : l.target.id;
    return s === focus || tg === focus;
  };

  function toSvg(clientX: number, clientY: number) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const p = svg.createSVGPoint(); p.x = clientX; p.y = clientY;
    const m = svg.getScreenCTM()?.inverse();
    const r = m ? p.matrixTransform(m) : p;
    return { x: r.x, y: r.y };
  }
  function onDown(e: React.PointerEvent, id: string) {
    e.stopPropagation();
    dragState.current = { id, moved: false };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }
  function onMove(e: React.PointerEvent) {
    if (!dragState.current) return;
    const { x, y } = toSvg(e.clientX, e.clientY);
    dragState.current.moved = true;
    const id = dragState.current.id;
    setDrag((d) => ({ ...d, [id]: { x, y } }));
  }
  function onUp(node: GNode) {
    const ds = dragState.current;
    dragState.current = null;
    if (ds && !ds.moved) {
      if (node.kind === "inf") setPinned((p) => (p === node.id ? null : node.id));
      setSel(node.id);
    }
  }

  // 选中节点的关联帖子
  const selNode = nodes.find((n) => n.id === sel);
  const relPosts = useMemo(() => {
    if (!sel) return [];
    const seen = new Set<string>();
    return fEdges
      .filter((e) => e.influencerId === sel || e.symbol === sel)
      .filter((e) => (seen.has(e.postId) ? false : (seen.add(e.postId), true)))
      .map((e) => ({
        postId: e.postId,
        stance: e.stance,
        symbol: e.symbol,
        text: (locale === "en" ? e.snippetEn : e.snippetZh) || e.snippet,
      }));
  }, [sel, fEdges, locale]);

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
        {pinned && <button className="segbtn" onClick={() => { setPinned(null); setSel(null); }}>{t.graph.clearFocus} ✕</button>}
        <button className="segbtn" onClick={() => { if (document.fullscreenElement) document.exitFullscreen(); else frameRef.current?.requestFullscreen(); }}>{fs ? t.graph.exitFull : t.graph.fullscreen}</button>
      </div>

      {fEdges.length === 0 ? (
        <div className="empty">{t.graph.emptyFilter}</div>
      ) : !mounted ? (
        <div className="graph-frame" style={{ minHeight: "40vh" }} />
      ) : (
        <div className={`graph-frame${fs ? " fs" : ""}`} ref={frameRef}>
          <svg ref={svgRef} viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} role="img" aria-label={t.graph.title}
            onPointerMove={onMove}
            style={{ width: "100%", height: fs ? "100%" : "auto", maxHeight: fs ? "100%" : "78vh", display: "block", touchAction: "none" }}>
            <defs>
              {nodes.filter((n) => n.kind === "inf" && n.avatarUrl).map((n) => {
                const p = pos(n.id);
                return <clipPath id={`gc-${n.id}`} key={n.id}><circle cx={p.x} cy={p.y} r={R_INF} /></clipPath>;
              })}
            </defs>

            {fEdges.map((e, i) => {
              const a = pos(e.influencerId), b = pos(e.symbol);
              const on = linkOn({ source: e.influencerId, target: e.symbol, stance: e.stance, flipped: e.flipped, ts: e.ts });
              const r = recency(e.ts);
              return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={STANCE_COLOR[e.stance]} strokeWidth={on ? r.width : 1.5} opacity={on ? r.opacity : 0.06} strokeDasharray={e.flipped ? "8 5" : undefined} strokeLinecap="round" />;
            })}

            {fEdges.map((e, i) => {
              if (!e.flipped || !linkOn({ source: e.influencerId, target: e.symbol, stance: e.stance, flipped: e.flipped, ts: e.ts })) return null;
              const a = pos(e.influencerId), b = pos(e.symbol);
              const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
              return (
                <g key={`f-${i}`} style={{ pointerEvents: "none" }}>
                  <circle cx={mx} cy={my} r={9} fill="var(--bg-secondary)" stroke="var(--blue)" strokeWidth={2} />
                  <text x={mx} y={my + 4} textAnchor="middle" style={{ fill: "var(--blue)", fontSize: 11, fontWeight: 800 }}>⇄</text>
                </g>
              );
            })}

            {nodes.map((n) => {
              const p = pos(n.id);
              const dim = !connected(n.id);
              const isSel = focus === n.id || sel === n.id;
              const common = {
                style: { cursor: "grab" as const, opacity: dim ? 0.18 : 1, transition: dragState.current ? "none" : "opacity .15s" },
                onPointerDown: (ev: React.PointerEvent) => onDown(ev, n.id),
                onPointerUp: () => onUp(n),
                onMouseEnter: () => setHover(n.id),
                onMouseLeave: () => setHover(null),
              };
              if (n.kind === "inf") {
                return (
                  <g key={n.id} {...common}>
                    <circle cx={p.x + 3} cy={p.y + 3} r={R_INF} fill="var(--ink)" />
                    <circle cx={p.x} cy={p.y} r={R_INF} fill="var(--bg-secondary)" stroke={isSel ? "var(--blue)" : "var(--ink)"} strokeWidth={isSel ? 4 : 3} />
                    {n.avatarUrl ? (
                      <image href={n.avatarUrl} x={p.x - R_INF} y={p.y - R_INF} width={R_INF * 2} height={R_INF * 2} clipPath={`url(#gc-${n.id})`} preserveAspectRatio="xMidYMid slice" />
                    ) : (
                      <text x={p.x} y={p.y + 5} textAnchor="middle" style={{ fill: "var(--ink)", fontSize: 16, fontWeight: 700 }}>{n.label.slice(0, 1).toUpperCase()}</text>
                    )}
                    <text x={p.x} y={p.y + R_INF + 13} textAnchor="middle" style={{ fill: "var(--ink)", fontSize: 11, fontWeight: 700, pointerEvents: "none" }}>{n.label.slice(0, 14)}</text>
                  </g>
                );
              }
              return (
                <g key={n.id} {...common}>
                  <rect x={p.x - CHIP_W / 2 + 3} y={p.y - CHIP_H / 2 + 3} width={CHIP_W} height={CHIP_H} rx={3} fill="var(--ink)" />
                  <rect x={p.x - CHIP_W / 2} y={p.y - CHIP_H / 2} width={CHIP_W} height={CHIP_H} rx={3} fill="var(--bg-secondary)" stroke={isSel ? "var(--blue)" : "var(--ink)"} strokeWidth={isSel ? 4 : 3} />
                  <text x={p.x} y={p.y + 5} textAnchor="middle" style={{ fill: "var(--ink)", fontSize: 13, fontWeight: 700, pointerEvents: "none" }}>${n.label} <tspan style={{ fill: "var(--text-tertiary)", fontSize: 10 }}>×{n.count}</tspan></text>
                </g>
              );
            })}
          </svg>

          {sel && selNode && (
            <div className="graph-panel">
              <div className="graph-panel-head">
                <strong>{selNode.kind === "sec" ? `$${selNode.label}` : selNode.label}</strong>
                <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                  <Link href={selNode.kind === "sec" ? `/t/${selNode.id}` : `/i/${(influencers.find((i) => i.id === selNode.id)?.handle ?? "")}`} className="graph-panel-link">{t.graph.openPage}</Link>
                  <button className="graph-panel-x" onClick={() => { setSel(null); setPinned(null); }} aria-label="close">✕</button>
                </div>
              </div>
              <div className="graph-panel-list">
                {relPosts.map((p) => (
                  <button key={p.postId} className="graph-post" onClick={() => router.push(`/p/${p.postId}`)}>
                    <span className="badge" style={{ borderColor: STANCE_COLOR[p.stance], color: "var(--ink)", flex: "0 0 auto" }}>{p.stance === "bullish" ? "▲" : p.stance === "bearish" ? "▼" : "—"} ${p.symbol}</span>
                    <span className="graph-post-text">{p.text}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="graph-legend">
        <span className="badge bull">▲ {t.stance.bullish}</span>
        <span className="badge bear">▼ {t.stance.bearish}</span>
        <span className="badge neutral">— {t.stance.neutral}</span>
        <span className="hint" style={{ marginLeft: "auto" }}>{infCountN} {t.graph.influencersWord} · {secCountN} {t.graph.stocksWord} · {fEdges.length} {t.graph.relationsWord}</span>
      </div>
      <p className="hint" style={{ marginTop: "0.6rem" }}>{t.graph.hint2}</p>
    </>
  );
}
