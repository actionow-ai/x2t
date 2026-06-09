import { prisma } from "./db";
import type { Stance } from "@prisma/client";
import { binomTestGreater, benjaminiHochberg } from "./stats";

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

// 跨博主"近期立场转向":每个(博主×标的)取最新一条,且较上一条发生转向,按时间倒序。
// 这是护城河信号——首页头条/异动看板用。
export type RecentFlip = { handle: string; displayName: string | null; symbol: string; stance: Stance; prevStance: Stance; postId: string; postedAt: Date };
export async function getRecentFlips(limit = 8): Promise<RecentFlip[]> {
  type Row = { handle: string; displayName: string | null; symbol: string; stance: Stance; prevStance: Stance | null; postId: string; postedAt: Date };
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT t.handle, t."displayName", t.symbol, t.stance, t."prevStance", t."postId", t."postedAt"
    FROM (
      SELECT inf.handle, inf."displayName", pt.symbol, pt.stance, pt."postId", p."postedAt",
             row_number() OVER (PARTITION BY p."influencerId", pt.symbol ORDER BY p."postedAt" DESC) AS rn,
             lead(pt.stance) OVER (PARTITION BY p."influencerId", pt.symbol ORDER BY p."postedAt" DESC) AS "prevStance"
      FROM "PostTicker" pt
      JOIN "Post" p ON p.id = pt."postId"
      JOIN "Influencer" inf ON inf.id = p."influencerId"
    ) t
    WHERE t.rn = 1 AND t."prevStance" IS NOT NULL AND t."prevStance" <> t.stance
    ORDER BY t."postedAt" DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => ({ ...r, prevStance: r.prevStance as Stance, postedAt: new Date(r.postedAt) }));
}

// 基准标的(始终回填),供胜率做"同期大盘"对比。
export const BENCHMARK_SYMBOL = "SPY";
// 战绩展示门槛:>=SHOW 才出比率(带显著置信区间);<SHOW 显示"积累中";<CONFIDENT 附"样本少"提示。
// (黑盒:门槛=30 让战绩对所有人隐形、像没东西;改为分级展示——可见但用宽 CI + 提示如实表达不确定性。)
const WINRATE_SHOW = Number(process.env.WINRATE_SHOW_SAMPLES ?? 10);
const WINRATE_CONFIDENT = Number(process.env.WINRATE_CONFIDENT_SAMPLES ?? 30);

// 二项比例的 Wilson 95% 置信区间(比 Wald 在小样本更稳)。
export function wilson95(hits: number, n: number): [number, number] {
  if (n === 0) return [0, 0];
  const z = 1.96;
  const p = hits / n;
  const denom = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / denom;
  const margin = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return [Math.max(0, center - margin), Math.min(1, center + margin)];
}

/**
 * 博主历史"跑赢大盘"率(方法论重做,回应审计 P0):
 * - 入场=call 当日或之后首个交易日收盘;出场=入场后第 N 个【交易日】(按交易日索引,不用自然日,避开周末漂移)。
 * - 命中 = 跟随该立场方向的收益(看多取涨、看空取跌)【超过】同期 SPY 收益(有基准,不是绝对涨跌)。
 * - 样本 < WINRATE_MIN 返回 null(不展示);返回 Wilson 95% 置信区间 + 平均超额收益。
 * - 退市/无价标的因拉不到价被自然排除(幸存者偏差),文案需注明。
 */

// 单条已结算 call(供胜率/权益曲线/排行榜共用,避免重复 SQL)。
type ResolvedCall = { postedAt: number; aligned: number; spy: number; excess: number; beat: boolean };

// 解析某博主所有【已到第 N 交易日且有 SPY 价】的多/空 call,按时间升序返回。无价/无基准则空。
async function resolveCalls(influencerId: string, horizonTradingDays = 5): Promise<ResolvedCall[]> {
  const calls = await prisma.postTicker.findMany({
    where: { post: { influencerId }, stance: { in: ["bullish", "bearish"] } },
    select: { symbol: true, stance: true, post: { select: { postedAt: true } } },
  });
  if (calls.length === 0) return [];
  const symbols = [...new Set([...calls.map((c) => c.symbol), BENCHMARK_SYMBOL])];
  const prices = await prisma.priceDaily.findMany({
    where: { symbol: { in: symbols } },
    orderBy: { date: "asc" },
    select: { symbol: true, date: true, close: true },
  });
  const bySym = new Map<string, { t: number; close: number }[]>();
  for (const p of prices) {
    if (!bySym.has(p.symbol)) bySym.set(p.symbol, []);
    bySym.get(p.symbol)!.push({ t: new Date(p.date).getTime(), close: p.close });
  }
  const spy = bySym.get(BENCHMARK_SYMBOL);
  if (!spy || !spy.length) return [];
  const closeAtOrAfter = (arr: { t: number; close: number }[], target: number) => arr.find((x) => x.t >= target)?.close;

  const out: ResolvedCall[] = [];
  for (const c of calls) {
    const arr = bySym.get(c.symbol);
    if (!arr) continue;
    const callT = new Date(c.post.postedAt).setUTCHours(0, 0, 0, 0);
    const ei = arr.findIndex((x) => x.t >= callT);
    if (ei < 0 || ei + horizonTradingDays >= arr.length) continue;
    const entry = arr[ei];
    const exit = arr[ei + horizonTradingDays];
    const spyEntry = closeAtOrAfter(spy, entry.t);
    const spyExit = closeAtOrAfter(spy, exit.t);
    if (spyEntry === undefined || spyExit === undefined) continue;
    const raw = (exit.close - entry.close) / entry.close;
    const aligned = c.stance === "bullish" ? raw : -raw;
    const spyRet = (spyExit - spyEntry) / spyEntry;
    out.push({ postedAt: callT, aligned, spy: spyRet, excess: aligned - spyRet, beat: aligned - spyRet > 0 });
  }
  out.sort((a, b) => a.postedAt - b.postedAt);
  return out;
}

export type WinRate = {
  samples: number;
  // 样本 >= SHOW 才有比率;否则 rate=null(展示为"积累中 N/SHOW")
  rate: { beatRate: number; ci: [number, number]; avgExcess: number; lowSample: boolean } | null;
};
export async function getInfluencerWinRate(influencerId: string): Promise<WinRate | null> {
  const r = await resolveCalls(influencerId);
  if (r.length === 0) return null;
  if (r.length < WINRATE_SHOW) return { samples: r.length, rate: null };
  const beats = r.filter((x) => x.beat).length;
  const avgExcess = r.reduce((s, x) => s + x.excess, 0) / r.length;
  return {
    samples: r.length,
    rate: { beatRate: beats / r.length, ci: wilson95(beats, r.length), avgExcess, lowSample: r.length < WINRATE_CONFIDENT },
  };
}

// "如果跟单 vs SPY"权益曲线(借鉴 Vibe-Trading / AI-Trader):逐条已结算 call 累加跟随方向收益 vs 同期 SPY。
// 把"跑赢大盘 X%"从一个数字变成一条可看的轨迹。返回累计收益点(加法,单位=收益占比)。
export type EquityCurve = { points: { follow: number; spy: number }[]; samples: number; totalFollow: number; totalSpy: number };
export async function getInfluencerEquityCurve(influencerId: string): Promise<EquityCurve | null> {
  const r = await resolveCalls(influencerId);
  if (r.length < WINRATE_SHOW) return null;
  let f = 0;
  let s = 0;
  const points = r.map((x) => {
    f += x.aligned;
    s += x.spy;
    return { follow: f, spy: s };
  });
  return { points, samples: r.length, totalFollow: f, totalSpy: s };
}

// 博主战绩排行榜(借鉴 AI-Trader):按"跑赢大盘"率排序,并用 BH-FDR 校正多重比较——
// 同时比 N 个博主时,不校正会让榜首必混进"幸运儿"假阳性;significant=在 FDR 下显著强于抛硬币。
export type LeaderRow = { handle: string; displayName: string | null; beatRate: number; samples: number; avgExcess: number; significant: boolean };
export async function getLeaderboard(minSamples = WINRATE_SHOW): Promise<LeaderRow[]> {
  const infs = await prisma.influencer.findMany({ select: { id: true, handle: true, displayName: true } });
  const rows: (Omit<LeaderRow, "significant"> & { pvalue: number })[] = [];
  for (const inf of infs) {
    const r = await resolveCalls(inf.id);
    if (r.length < minSamples) continue;
    const beats = r.filter((x) => x.beat).length;
    rows.push({
      handle: inf.handle,
      displayName: inf.displayName,
      beatRate: beats / r.length,
      samples: r.length,
      avgExcess: r.reduce((acc, x) => acc + x.excess, 0) / r.length,
      pvalue: binomTestGreater(beats, r.length),
    });
  }
  const sig = benjaminiHochberg(rows.map((r) => r.pvalue));
  return rows
    .map((r, i) => ({ handle: r.handle, displayName: r.displayName, beatRate: r.beatRate, samples: r.samples, avgExcess: r.avgExcess, significant: sig[i] }))
    .sort((a, b) => b.beatRate - a.beatRate || b.samples - a.samples);
}

// 某票的"多空论据"——借鉴 TradingAgents 的 Bull vs Bear 辩论,但零 LLM 成本:
// 直接取各博主对该票最新一条多/空帖的 AI rationale,分多头/空头两栏。把"谁多谁空"升级成"多空在争什么"。
export type DebatePoint = { handle: string; displayName: string | null; rationale: string; postId: string };
export async function getStockDebate(symbol: string, locale: "zh" | "en"): Promise<{ bull: DebatePoint[]; bear: DebatePoint[] }> {
  const sym = symbol.toUpperCase();
  type Row = { stance: Stance; handle: string; displayName: string | null; postId: string; rationale: string | null; rationaleEn: string | null };
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT t.stance, t.handle, t."displayName", t."postId", t.rationale, t."rationaleEn"
    FROM (
      SELECT pt.stance, inf.handle, inf."displayName", pt."postId", pt.rationale, pt."rationaleEn",
             row_number() OVER (PARTITION BY p."influencerId" ORDER BY p."postedAt" DESC) AS rn
      FROM "PostTicker" pt
      JOIN "Post" p ON p.id = pt."postId"
      JOIN "Influencer" inf ON inf.id = p."influencerId"
      WHERE pt.symbol = ${sym} AND pt.stance IN ('bullish','bearish')
    ) t WHERE t.rn = 1
    ORDER BY t."postId" DESC
  `;
  const pick = (r: Row): DebatePoint => ({
    handle: r.handle,
    displayName: r.displayName,
    postId: r.postId,
    rationale: (locale === "en" ? r.rationaleEn : r.rationale) ?? r.rationale ?? r.rationaleEn ?? "",
  });
  return {
    bull: rows.filter((r) => r.stance === "bullish" && (r.rationale || r.rationaleEn)).map(pick).slice(0, 4),
    bear: rows.filter((r) => r.stance === "bearish" && (r.rationale || r.rationaleEn)).map(pick).slice(0, 4),
  };
}
