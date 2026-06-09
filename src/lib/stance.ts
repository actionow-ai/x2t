import { prisma } from "./db";
import type { Stance } from "@prisma/client";

// 时效性 / 立场逻辑 —— 设计文档 §6。
// 核心：每帖是带时间戳的立场快照；派生"博主×股票当前立场"= 最新一条；转向 = 与上一条不同。

export type InfluencerStance = {
  influencerId: string;
  handle: string;
  displayName: string | null;
  stance: Stance;
  postId: string;
  postedAt: Date;
  prevStance: Stance | null;
  flipped: boolean;
};

export type StockConsensus = {
  symbol: string;
  name: string | null;
  stances: InfluencerStance[]; // 每博主一条（最新），时间倒序
  bullish: number;
  bearish: number;
  neutral: number;
};

/**
 * 某只票的共识：每个博主取【最新】立场（每博主一条）。
 * 转向用全量历史判断；windowDays 只过滤"计入共识"的最新立场是否够新。
 */
export async function getStockConsensus(symbol: string, windowDays?: number): Promise<StockConsensus> {
  const sym = symbol.toUpperCase();
  // 每博主取该票最近两条立场(rn=1 最新、rn=2 上一条供转向),窗口函数一次查全 ——
  // 不再像旧版那样全局 take 截断,避免热门票下低频博主的"最新一条/上一条"被截掉导致共识与转向算错。
  type Row = { stance: Stance; influencerId: string; postedAt: Date; postId: string; handle: string; displayName: string | null; rn: number };
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT t.stance, t."influencerId", t."postedAt", t."postId", t.handle, t."displayName", t.rn::int AS rn
    FROM (
      SELECT pt.stance, p."influencerId", p."postedAt", pt."postId", inf.handle, inf."displayName",
             row_number() OVER (PARTITION BY p."influencerId" ORDER BY p."postedAt" DESC) AS rn
      FROM "PostTicker" pt
      JOIN "Post" p ON p.id = pt."postId"
      JOIN "Influencer" inf ON inf.id = p."influencerId"
      WHERE pt.symbol = ${sym}
    ) t
    WHERE t.rn <= 2
    ORDER BY t."influencerId", t.rn
  `;

  const byInf = new Map<string, Row[]>();
  for (const r of rows) {
    if (!byInf.has(r.influencerId)) byInf.set(r.influencerId, []);
    byInf.get(r.influencerId)!.push(r);
  }

  const since = windowDays ? Date.now() - windowDays * 86_400_000 : 0;
  const stances: InfluencerStance[] = [];
  for (const list of byInf.values()) {
    const latest = list.find((r) => r.rn === 1) ?? list[0];
    if (new Date(latest.postedAt).getTime() < since) continue; // 窗口外不计入共识
    const prev = list.find((r) => r.rn === 2);
    stances.push({
      influencerId: latest.influencerId,
      handle: latest.handle,
      displayName: latest.displayName,
      stance: latest.stance,
      postId: latest.postId,
      postedAt: new Date(latest.postedAt),
      prevStance: prev ? prev.stance : null,
      flipped: prev ? prev.stance !== latest.stance : false,
    });
  }
  stances.sort((a, b) => b.postedAt.getTime() - a.postedAt.getTime());

  const security = await prisma.security.findUnique({ where: { symbol: sym } });
  return {
    symbol: sym,
    name: security?.name ?? null,
    stances,
    bullish: stances.filter((s) => s.stance === "bullish").length,
    bearish: stances.filter((s) => s.stance === "bearish").length,
    neutral: stances.filter((s) => s.stance === "neutral").length,
  };
}

export type GraphData = {
  influencers: { id: string; handle: string; displayName: string | null; avatarUrl: string | null; count: number }[];
  securities: { symbol: string; count: number }[];
  edges: {
    influencerId: string;
    symbol: string;
    stance: Stance;
    ts: number;
    flipped: boolean;
    postId: string;
    snippet: string;
    snippetZh: string | null;
    snippetEn: string | null;
  }[];
};

function snip(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = s.trim().replace(/\s+/g, " ");
  return t.length > 110 ? t.slice(0, 110) + "…" : t;
}

// 图谱开销最大且无参 → 进程内 memo(单容器有效)+ 时间窗 + 扫描上限,防数据增长后全表扫描失控。
let graphMemo: { at: number; data: GraphData } | null = null;

/** 全景图谱数据：每个 (博主×票) 取最新立场作为一条边。窗口/上限/缓存均可env 调。 */
export async function getGraphData(): Promise<GraphData> {
  const memoMs = Number(process.env.GRAPH_MEMO_MS ?? 60_000);
  if (graphMemo && Date.now() - graphMemo.at < memoMs) return graphMemo.data;

  const windowDays = Number(process.env.GRAPH_WINDOW_DAYS ?? 90);
  const since = new Date(Date.now() - windowDays * 86_400_000);
  // 每 (博主×票) 取最新一条边(rn=1);转向 = 最新立场 ≠ 紧邻上一条(lead)。
  // 窗口内一次查全,DISTINCT 到"每对一行",不再用扫描上限截断(旧版 take 会漏边/漏转向)。
  type GRow = {
    influencerId: string;
    symbol: string;
    stance: Stance;
    postedAt: Date;
    postId: string;
    handle: string;
    displayName: string | null;
    avatarUrl: string | null;
    contentText: string;
    contentZh: string | null;
    contentEn: string | null;
    prevStance: Stance | null;
  };
  const rows = await prisma.$queryRaw<GRow[]>`
    SELECT t."influencerId", t.symbol, t.stance, t."postedAt", t."postId",
           t.handle, t."displayName", t."avatarUrl",
           t."contentText", t."contentZh", t."contentEn", t."prevStance"
    FROM (
      SELECT p."influencerId", pt.symbol, pt.stance, p."postedAt", pt."postId",
             inf.handle, inf."displayName", inf."avatarUrl",
             p."contentText", p."contentZh", p."contentEn",
             row_number() OVER (PARTITION BY p."influencerId", pt.symbol ORDER BY p."postedAt" DESC) AS rn,
             lead(pt.stance) OVER (PARTITION BY p."influencerId", pt.symbol ORDER BY p."postedAt" DESC) AS "prevStance"
      FROM "PostTicker" pt
      JOIN "Post" p ON p.id = pt."postId"
      JOIN "Influencer" inf ON inf.id = p."influencerId"
      WHERE p."postedAt" >= ${since}
    ) t
    WHERE t.rn = 1
    ORDER BY t."postedAt" DESC
  `;

  const edges: GraphData["edges"] = [];
  const influencers = new Map<
    string,
    { id: string; handle: string; displayName: string | null; avatarUrl: string | null; count: number }
  >();
  const secCount = new Map<string, number>();

  for (const r of rows) {
    edges.push({
      influencerId: r.influencerId,
      symbol: r.symbol,
      stance: r.stance,
      ts: new Date(r.postedAt).getTime(),
      flipped: r.prevStance != null && r.prevStance !== r.stance,
      postId: r.postId,
      snippet: snip(r.contentText) ?? "",
      snippetZh: snip(r.contentZh),
      snippetEn: snip(r.contentEn),
    });
    const prev = influencers.get(r.influencerId);
    influencers.set(r.influencerId, {
      id: r.influencerId,
      handle: r.handle,
      displayName: r.displayName,
      avatarUrl: r.avatarUrl,
      count: (prev?.count ?? 0) + 1,
    });
    secCount.set(r.symbol, (secCount.get(r.symbol) ?? 0) + 1);
  }

  const data: GraphData = {
    influencers: [...influencers.values()].sort((a, b) => b.count - a.count),
    securities: [...secCount.entries()].map(([symbol, count]) => ({ symbol, count })).sort((a, b) => b.count - a.count),
    edges,
  };
  graphMemo = { at: Date.now(), data };
  return data;
}

/** 转向检测：某帖每只票 vs 该博主对该票更早一条立场，返回发生转向的票。 */
export async function detectFlips(
  postId: string,
): Promise<{ symbol: string; prevStance: Stance; newStance: Stance }[]> {
  const post = await prisma.post.findUnique({ where: { id: postId }, include: { tickers: true } });
  if (!post) return [];
  const flips: { symbol: string; prevStance: Stance; newStance: Stance }[] = [];
  for (const t of post.tickers) {
    const prev = await prisma.postTicker.findFirst({
      where: {
        symbol: t.symbol,
        post: { influencerId: post.influencerId, id: { not: post.id }, postedAt: { lt: post.postedAt } },
      },
      orderBy: { post: { postedAt: "desc" } },
    });
    if (prev && prev.stance !== t.stance) {
      flips.push({ symbol: t.symbol, prevStance: prev.stance, newStance: t.stance });
    }
  }
  return flips;
}

// 博主"立场账本":对每个标的取其最新立场(每标的一条)+ 是否较上一条转向。立场轨迹的核心数据。
export type LedgerEntry = { symbol: string; stance: Stance; postedAt: Date; postId: string; flipped: boolean };
export async function getInfluencerLedger(influencerId: string, limit = 80): Promise<LedgerEntry[]> {
  type Row = { symbol: string; stance: Stance; postedAt: Date; postId: string; prevStance: Stance | null };
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT t.symbol, t.stance, t."postedAt", t."postId", t."prevStance"
    FROM (
      SELECT pt.symbol, pt.stance, p."postedAt", pt."postId",
             row_number() OVER (PARTITION BY pt.symbol ORDER BY p."postedAt" DESC) AS rn,
             lead(pt.stance) OVER (PARTITION BY pt.symbol ORDER BY p."postedAt" DESC) AS "prevStance"
      FROM "PostTicker" pt
      JOIN "Post" p ON p.id = pt."postId"
      WHERE p."influencerId" = ${influencerId}
    ) t
    WHERE t.rn = 1
    ORDER BY t."postedAt" DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => ({
    symbol: r.symbol,
    stance: r.stance,
    postedAt: new Date(r.postedAt),
    postId: r.postId,
    flipped: r.prevStance != null && r.prevStance !== r.stance,
  }));
}

// 博主历史胜率:对每条多/空 call,取入场价(call 当日或之后首个交易日收盘)与 N 日后收盘,
// 看多则涨为命中、看空则跌为命中。用 PriceDaily(Stooq 历史)回算。无足够价格数据 → null。
export async function getInfluencerWinRate(
  influencerId: string,
  horizonDays = 7,
): Promise<{ hitRate: number; samples: number; avgReturn: number } | null> {
  const calls = await prisma.postTicker.findMany({
    where: { post: { influencerId }, stance: { in: ["bullish", "bearish"] } },
    select: { symbol: true, stance: true, post: { select: { postedAt: true } } },
  });
  if (!calls.length) return null;

  const symbols = [...new Set(calls.map((c) => c.symbol))];
  const prices = await prisma.priceDaily.findMany({
    where: { symbol: { in: symbols } },
    orderBy: { date: "asc" },
    select: { symbol: true, date: true, close: true },
  });
  if (!prices.length) return null;
  const bySym = new Map<string, { t: number; close: number }[]>();
  for (const p of prices) {
    if (!bySym.has(p.symbol)) bySym.set(p.symbol, []);
    bySym.get(p.symbol)!.push({ t: new Date(p.date).getTime(), close: p.close });
  }
  // 取 arr 中第一个 t >= target 的收盘(已按 date 升序)
  const firstAtOrAfter = (arr: { t: number; close: number }[], target: number) => arr.find((x) => x.t >= target);

  let hits = 0;
  let samples = 0;
  let sumRet = 0;
  for (const c of calls) {
    const arr = bySym.get(c.symbol);
    if (!arr) continue;
    const callT = new Date(c.post.postedAt).setUTCHours(0, 0, 0, 0);
    const entry = firstAtOrAfter(arr, callT);
    if (!entry) continue;
    const exit = firstAtOrAfter(arr, entry.t + horizonDays * 86_400_000);
    if (!exit) continue; // 还没到 N 日后
    samples++;
    const ret = (exit.close - entry.close) / entry.close;
    sumRet += c.stance === "bullish" ? ret : -ret;
    if (c.stance === "bullish" ? ret > 0 : ret < 0) hits++;
  }
  if (samples === 0) return null;
  return { hitRate: hits / samples, samples, avgReturn: sumRet / samples };
}

// 某票截至某时刻的共识票数(每博主取其在该时刻前的最新立场)。供"近 N 天共识趋势"对比。
export async function consensusCountsAsOf(symbol: string, asOf: Date): Promise<{ bullish: number; bearish: number; neutral: number }> {
  const sym = symbol.toUpperCase();
  const rows = await prisma.$queryRaw<{ stance: Stance }[]>`
    SELECT t.stance FROM (
      SELECT pt.stance, row_number() OVER (PARTITION BY p."influencerId" ORDER BY p."postedAt" DESC) AS rn
      FROM "PostTicker" pt
      JOIN "Post" p ON p.id = pt."postId"
      WHERE pt.symbol = ${sym} AND p."postedAt" <= ${asOf}
    ) t WHERE t.rn = 1
  `;
  return {
    bullish: rows.filter((r) => r.stance === "bullish").length,
    bearish: rows.filter((r) => r.stance === "bearish").length,
    neutral: rows.filter((r) => r.stance === "neutral").length,
  };
}
