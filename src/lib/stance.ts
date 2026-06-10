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
  // 硬扫描窗口(默认 2 年):限制窗口函数扫描的历史行数,避免热门票全历史扫描;
  // 2 年没再提及的立场也不该计入"当前共识"。windowDays 是更窄的展示过滤(JS 层)。
  const scanSince = new Date(Date.now() - Number(process.env.CONSENSUS_SCAN_DAYS ?? 730) * 86_400_000);
  type Row = { stance: Stance; influencerId: string; postedAt: Date; postId: string; handle: string; displayName: string | null; rn: number };
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT t.stance, t."influencerId", t."postedAt", t."postId", t.handle, t."displayName", t.rn::int AS rn
    FROM (
      SELECT pt.stance, p."influencerId", p."postedAt", pt."postId", inf.handle, inf."displayName",
             row_number() OVER (PARTITION BY p."influencerId" ORDER BY p."postedAt" DESC) AS rn
      FROM "PostTicker" pt
      JOIN "Post" p ON p.id = pt."postId"
      JOIN "Influencer" inf ON inf.id = p."influencerId"
      WHERE pt.symbol = ${sym} AND p."postedAt" >= ${scanSince}
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
    LIMIT ${Number(process.env.GRAPH_MAX_EDGES ?? 600)}
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
// 直接读物化 Flip 表(分析时落库),索引读 + LIMIT,免对全量 PostTicker 做窗口扫描(性能 P0-1)。
export async function getRecentFlips(limit = 8): Promise<RecentFlip[]> {
  const rows = await prisma.flip.findMany({
    orderBy: { postedAt: "desc" },
    take: limit,
    select: { symbol: true, prevStance: true, newStance: true, postId: true, postedAt: true, influencer: { select: { handle: true, displayName: true } } },
  });
  return rows.map((r) => ({
    handle: r.influencer.handle,
    displayName: r.influencer.displayName,
    symbol: r.symbol,
    stance: r.newStance,
    prevStance: r.prevStance,
    postId: r.postId,
    postedAt: new Date(r.postedAt),
  }));
}

// 一次性把历史 PostTicker 的立场转向物化进 Flip 表(部署后/Flip 空时回填,让存量 flip 立即可读)。
// lag 按时间正序取前一条立场,与当前不同即转向;ON CONFLICT 幂等。
export async function backfillFlips(): Promise<number> {
  return prisma.$executeRaw`
    INSERT INTO "Flip" (id, "influencerId", symbol, "postId", "prevStance", "newStance", "postedAt", "createdAt")
    SELECT gen_random_uuid()::text, t."influencerId", t.symbol, t."postId", t."prevStance", t.stance, t."postedAt", now()
    FROM (
      SELECT p."influencerId", pt.symbol, pt.stance, pt."postId", p."postedAt",
             lag(pt.stance) OVER (PARTITION BY p."influencerId", pt.symbol ORDER BY p."postedAt") AS "prevStance"
      FROM "PostTicker" pt JOIN "Post" p ON p.id = pt."postId"
    ) t
    WHERE t."prevStance" IS NOT NULL AND t."prevStance" <> t.stance
    ON CONFLICT ("postId", symbol) DO NOTHING
  `;
}

// 基准标的(始终回填),供胜率做"同期大盘"对比。
export const BENCHMARK_SYMBOL = "SPY";
// 战绩展示门槛:>=SHOW 才出比率(带显著置信区间);<SHOW 显示"积累中";<CONFIDENT 附"样本少"提示。
// (黑盒:门槛=30 让战绩对所有人隐形、像没东西;改为分级展示——可见但用宽 CI + 提示如实表达不确定性。)
const WINRATE_SHOW = Number(process.env.WINRATE_SHOW_SAMPLES ?? 10);
const WINRATE_CONFIDENT = Number(process.env.WINRATE_CONFIDENT_SAMPLES ?? 30);

// 二项比例的 Wilson 95% 置信区间(比 Wald 在小样本更稳)。
export function wilson95(hits: number, n: number): [number, number] {
  if (n === 0) return [0, 1]; // 无样本 = 无信息,返回全区间(而非 [0,0] 误示"确定 0%")
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
export type ResolvedCall = { postedAt: number; aligned: number; spy: number; excess: number; beat: boolean };
export type RawCall = { symbol: string; stance: "bullish" | "bearish"; postedAtMs: number };
export type PricePoint = { t: number; close: number };

// 入场 bar 距发帖最大容差:超过视为左删失(post 早于价格窗口/长数据缺口),剔除而非吸附到最旧 bar(stataudit-1)。
const MAX_ENTRY_GAP_MS = Number(process.env.MAX_ENTRY_GAP_DAYS ?? 10) * 86_400_000;

/**
 * 纯函数:把多/空 call 配对历史价格结算成"超额收益"样本(可单测,不碰 DB)。修复统计审计三个 P0/P1:
 * - P0-2 look-ahead:入场取【严格晚于发帖时间戳】的第一根日线收盘(价格日期为当日 00:00 UTC,
 *   盘后帖发帖时刻晚于此 → 自动跳到次一交易日入场,绝不偷看发帖时已知的当日收盘)。
 * - P0-3 伪重复样本:同标的同方向、入场间隔 < horizon 的后续 call 视为同一持仓的重复,合并不重复计样本。
 * - 诚实性#6 flip 截断:出现反向 call 时,前一持仓出场提前到反向 call 入场日,不再按满 horizon 结算。
 * - P1-5 空头基准:看空对照"做空 SPY"(市场中性),零技能看空者期望超额≈0,不再被结构性压低。
 */
export function settleCalls(calls: RawCall[], bySym: Map<string, PricePoint[]>, spy: PricePoint[], horizon: number): ResolvedCall[] {
  if (!spy.length) return [];
  // SPY 基准用"不晚于标的 bar 日"的最近收盘对齐:原 closeAtOrAfter 对加密周末入场会取到下周一 SPY,
  // 使 aligned 与 benchRet 度量不同时间窗;且 SPY 缺当日 bar 时会取不到而误丢样本(stataudit-2)。
  const closeAtOrBefore = (arr: PricePoint[], target: number) => {
    let v: number | undefined;
    for (const x of arr) {
      if (x.t <= target) v = x.close;
      else break;
    }
    return v;
  };

  // 1) 定位每个 call 的入场 index(严格晚于发帖时间戳)
  type Located = { symbol: string; stance: "bullish" | "bearish"; ei: number; arr: PricePoint[] };
  const bySymCalls = new Map<string, Located[]>();
  for (const c of calls) {
    const arr = bySym.get(c.symbol);
    if (!arr || !arr.length) continue;
    const ei = arr.findIndex((x) => x.t > c.postedAtMs);
    if (ei < 0) continue;
    // 入场 bar 距发帖过远 = 左删失(post 早于价格窗口):剔除,勿吸附到最旧 bar 注入凭空的"跑赢"样本(stataudit-1)
    if (arr[ei].t - c.postedAtMs > MAX_ENTRY_GAP_MS) continue;
    if (!bySymCalls.has(c.symbol)) bySymCalls.set(c.symbol, []);
    bySymCalls.get(c.symbol)!.push({ symbol: c.symbol, stance: c.stance, ei, arr });
  }

  const out: ResolvedCall[] = [];
  for (const list of bySymCalls.values()) {
    list.sort((a, b) => a.ei - b.ei);
    // 2) 去伪重复:同向且入场间隔 < horizon 的重复 call 跳过
    const kept: Located[] = [];
    let last: Located | null = null;
    for (const c of list) {
      if (last && c.stance === last.stance && c.ei - last.ei < horizon) continue;
      kept.push(c);
      last = c;
    }
    // 3) 结算:出场 = min(ei+horizon, 下一个保留 call 的入场)→ 反向 call 触发提前平仓(flip 截断)
    for (let i = 0; i < kept.length; i++) {
      const c = kept[i];
      const next = kept[i + 1];
      const exitIdx = Math.min(c.ei + horizon, next ? next.ei : c.ei + horizon);
      if (exitIdx <= c.ei || exitIdx >= c.arr.length) continue; // 出场无效或未到期
      const entry = c.arr[c.ei];
      const exit = c.arr[exitIdx];
      const spyEntry = closeAtOrBefore(spy, entry.t);
      const spyExit = closeAtOrBefore(spy, exit.t);
      if (spyEntry === undefined || spyExit === undefined) continue;
      const raw = (exit.close - entry.close) / entry.close;
      const aligned = c.stance === "bullish" ? raw : -raw;
      const spyRet = (spyExit - spyEntry) / spyEntry;
      const benchRet = c.stance === "bullish" ? spyRet : -spyRet; // 空头对照做空 SPY(市场中性)
      const excess = aligned - benchRet;
      out.push({ postedAt: entry.t, aligned, spy: spyRet, excess, beat: excess > 0 });
    }
  }
  out.sort((a, b) => a.postedAt - b.postedAt);
  return out;
}

// SPY 基准序列进程内 memo(60s):排行榜逐博主回测时跨博主共享,避免每个博主都全量拉一遍 SPY。
let spyMemo: { at: number; data: PricePoint[] } | null = null;
async function getSpySeries(sinceMs: number): Promise<PricePoint[]> {
  const memoMs = Number(process.env.SPY_MEMO_MS ?? 60_000);
  if (!spyMemo || Date.now() - spyMemo.at >= memoMs) {
    const rows = await prisma.priceDaily.findMany({ where: { symbol: BENCHMARK_SYMBOL }, orderBy: { date: "asc" }, select: { date: true, close: true } });
    spyMemo = { at: Date.now(), data: rows.map((p) => ({ t: new Date(p.date).getTime(), close: p.close })) };
  }
  return spyMemo.data.filter((x) => x.t >= sinceMs);
}

// 解析某博主所有【已结算】的多/空 call(取数 + 调纯函数 settleCalls)。无价/无基准则空。
async function resolveCalls(influencerId: string, horizonTradingDays = 5): Promise<ResolvedCall[]> {
  const calls = await prisma.postTicker.findMany({
    where: { post: { influencerId }, stance: { in: ["bullish", "bearish"] } },
    select: { symbol: true, stance: true, post: { select: { postedAt: true } } },
  });
  if (calls.length === 0) return [];
  const rawCalls: RawCall[] = calls.map((c) => ({ symbol: c.symbol, stance: c.stance as "bullish" | "bearish", postedAtMs: new Date(c.post.postedAt).getTime() }));
  const since = new Date(Math.min(...rawCalls.map((c) => c.postedAtMs)));
  since.setUTCHours(0, 0, 0, 0);
  const symbols = [...new Set(rawCalls.map((c) => c.symbol))];
  const prices = await prisma.priceDaily.findMany({
    where: { symbol: { in: symbols }, date: { gte: since } },
    orderBy: { date: "asc" },
    select: { symbol: true, date: true, close: true },
  });
  const bySym = new Map<string, PricePoint[]>();
  for (const p of prices) {
    if (!bySym.has(p.symbol)) bySym.set(p.symbol, []);
    bySym.get(p.symbol)!.push({ t: new Date(p.date).getTime(), close: p.close });
  }
  const spy = await getSpySeries(since.getTime());
  return settleCalls(rawCalls, bySym, spy, horizonTradingDays);
}

export type WinRate = {
  samples: number;
  // 样本 >= SHOW 才有比率;否则 rate=null(展示为"积累中 N/SHOW")
  rate: { beatRate: number; ci: [number, number]; avgExcess: number; lowSample: boolean } | null;
};
function winRateFromResolved(r: ResolvedCall[]): WinRate | null {
  if (r.length === 0) return null;
  if (r.length < WINRATE_SHOW) return { samples: r.length, rate: null };
  const beats = r.filter((x) => x.beat).length;
  const avgExcess = r.reduce((s, x) => s + x.excess, 0) / r.length;
  return { samples: r.length, rate: { beatRate: beats / r.length, ci: wilson95(beats, r.length), avgExcess, lowSample: r.length < WINRATE_CONFIDENT } };
}
export async function getInfluencerWinRate(influencerId: string): Promise<WinRate | null> {
  return winRateFromResolved(await resolveCalls(influencerId));
}

// "如果跟单 vs SPY"权益曲线(借鉴 Vibe-Trading / AI-Trader):逐条已结算 call 累加跟随方向收益 vs 同期 SPY。
export type EquityCurve = { points: { follow: number; spy: number }[]; samples: number; totalFollow: number; totalSpy: number };
function equityFromResolved(r: ResolvedCall[]): EquityCurve | null {
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
export async function getInfluencerEquityCurve(influencerId: string): Promise<EquityCurve | null> {
  return equityFromResolved(await resolveCalls(influencerId));
}

// 博主页一次结算同时出胜率 + 权益曲线(避免二者各跑一遍 resolveCalls,性能 P0-2/架构 P1-4)。
export async function getInfluencerBacktest(influencerId: string): Promise<{ winRate: WinRate | null; equity: EquityCurve | null }> {
  const r = await resolveCalls(influencerId);
  return { winRate: winRateFromResolved(r), equity: equityFromResolved(r) };
}

// 博主战绩排行榜(借鉴 AI-Trader):按"跑赢大盘"率排序,并用 BH-FDR 校正多重比较——
// 同时比 N 个博主时,不校正会让榜首必混进"幸运儿"假阳性;significant=在 FDR 下显著强于抛硬币。
// ciLow = Wilson 95% 下界(经样本量收缩的保守胜率),作排序键 + 可展示"至少跑赢"。
export type LeaderRow = { handle: string; displayName: string | null; beatRate: number; samples: number; avgExcess: number; significant: boolean; ciLow: number };
export async function getLeaderboard(minSamples = WINRATE_SHOW): Promise<LeaderRow[]> {
  const infs = await prisma.influencer.findMany({ select: { id: true, handle: true, displayName: true } });
  const rows: (LeaderRow & { pvalue: number })[] = [];
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
      ciLow: wilson95(beats, r.length)[0],
      significant: false,
      pvalue: binomTestGreater(beats, r.length),
    });
  }
  const sig = benjaminiHochberg(rows.map((r) => r.pvalue));
  rows.forEach((r, i) => (r.significant = sig[i]));
  // 排序键改为 Wilson 下界而非裸 beatRate——否则 n=10 蒙对 8 次(80%)会排在 n=120 的 65% 之上,
  // 小样本噪声盖过真 alpha(统计审计 P2-8)。
  rows.sort((a, b) => b.ciLow - a.ciLow || b.samples - a.samples);
  return rows.map((r) => ({ handle: r.handle, displayName: r.displayName, beatRate: r.beatRate, samples: r.samples, avgExcess: r.avgExcess, significant: r.significant, ciLow: r.ciLow }));
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
      SELECT pt.stance, inf.handle, inf."displayName", pt."postId", pt.rationale, pt."rationaleEn", p."postedAt",
             row_number() OVER (PARTITION BY p."influencerId" ORDER BY p."postedAt" DESC) AS rn
      FROM "PostTicker" pt
      JOIN "Post" p ON p.id = pt."postId"
      JOIN "Influencer" inf ON inf.id = p."influencerId"
      WHERE pt.symbol = ${sym} AND pt.stance IN ('bullish','bearish')
    ) t WHERE t.rn = 1
    ORDER BY t."postedAt" DESC
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
