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
  const rows = await prisma.postTicker.findMany({
    where: { symbol: sym },
    include: { post: { include: { influencer: true } } },
    orderBy: { post: { postedAt: "desc" } },
    take: Number(process.env.CONSENSUS_SCAN_CAP ?? 2000), // 兜底:取最近 N 条(时间倒序),够算"每博主最新+转向"
  });

  const byInf = new Map<string, typeof rows>();
  for (const r of rows) {
    const id = r.post.influencerId;
    if (!byInf.has(id)) byInf.set(id, []);
    byInf.get(id)!.push(r);
  }

  const since = windowDays ? Date.now() - windowDays * 86_400_000 : 0;
  const stances: InfluencerStance[] = [];
  for (const list of byInf.values()) {
    const latest = list[0];
    if (latest.post.postedAt.getTime() < since) continue; // 窗口外不计入共识
    const prev = list[1];
    stances.push({
      influencerId: latest.post.influencerId,
      handle: latest.post.influencer.handle,
      displayName: latest.post.influencer.displayName,
      stance: latest.stance,
      postId: latest.postId,
      postedAt: latest.post.postedAt,
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
  const rows = await prisma.postTicker.findMany({
    where: { post: { postedAt: { gte: since } } },
    include: { post: { include: { influencer: true } } },
    orderBy: { post: { postedAt: "desc" } },
    take: Number(process.env.GRAPH_SCAN_CAP ?? 5000),
  });

  const edges: GraphData["edges"] = [];
  const edgeByPair = new Map<string, GraphData["edges"][number]>();
  const influencers = new Map<
    string,
    { id: string; handle: string; displayName: string | null; avatarUrl: string | null; count: number }
  >();
  const secCount = new Map<string, number>();

  for (const r of rows) {
    const key = `${r.post.influencerId}::${r.symbol}`;
    const existing = edgeByPair.get(key);
    if (existing) {
      // 更早一条同 (博主×票) 的立场与最新不同 → 转向
      if (!existing.flipped && r.stance !== existing.stance) existing.flipped = true;
      continue;
    }
    // 第一条 = 最新（rows 时间倒序）
    const edge = {
      influencerId: r.post.influencerId,
      symbol: r.symbol,
      stance: r.stance,
      ts: r.post.postedAt.getTime(),
      flipped: false,
      postId: r.postId,
      snippet: snip(r.post.contentText) ?? "",
      snippetZh: snip(r.post.contentZh),
      snippetEn: snip(r.post.contentEn),
    };
    edgeByPair.set(key, edge);
    edges.push(edge);
    const prev = influencers.get(r.post.influencerId);
    influencers.set(r.post.influencerId, {
      id: r.post.influencerId,
      handle: r.post.influencer.handle,
      displayName: r.post.influencer.displayName,
      avatarUrl: r.post.influencer.avatarUrl,
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
