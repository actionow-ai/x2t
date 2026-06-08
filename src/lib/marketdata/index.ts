import { prisma } from "../db";
import type { MarketDataProvider, ExternalData } from "./types";
import { createMockMarketData } from "./mock";
import { createFinnhub, finnhubConfigured, finnhubEarnings } from "./finnhub";
import { exaConfigured, exaNews } from "./exa";
import { alphaVantageConfigured, avSentiment } from "./alphavantage";
import { fmpConfigured, fmpEvents } from "./fmp";

export function getMarketDataProvider(): MarketDataProvider {
  const key = process.env.FINNHUB_API_KEY;
  return key ? createFinnhub(key) : createMockMarketData();
}

// 按"类别"独立缓存:不同维度 TTL 差异大(行情分钟级、情绪/事件按天)。
// external_data_cache.dataType 区分类别;命中未过期则复用,否则跑 fetcher 后写缓存。
// 写缓存前 security 必须已存在(FK)——由 getExternalDataCached 顶部统一确保。
async function cachedCategory<T extends object>(
  sym: string,
  dataType: string,
  ttlMs: number,
  fetcher: () => Promise<T | null>,
): Promise<T | null> {
  const cached = await prisma.externalDataCache.findFirst({
    where: { symbol: sym, dataType, expiresAt: { gt: new Date() } },
    orderBy: { fetchedAt: "desc" },
  });
  if (cached) return cached.payload as T;

  let data: T | null = null;
  try {
    data = await fetcher();
  } catch (e) {
    console.error(`[marketdata] ${sym}/${dataType} 获取失败:`, e instanceof Error ? e.message : e);
  }
  // 即便为空也缓存(空对象),避免在 TTL 内反复打外部 API（尤其 AV 25/day 这种紧额度）。
  await prisma.externalDataCache.create({
    data: { symbol: sym, dataType, payload: (data ?? {}) as object, expiresAt: new Date(Date.now() + ttlMs) },
  });
  return data;
}

// 行情/概况/新闻 bundle(含 Exa 语义新闻增强)。
async function fetchBundle(sym: string): Promise<ExternalData> {
  const provider = getMarketDataProvider();
  let data: ExternalData = {};
  try {
    data = await provider.getExternalData(sym);
  } catch (e) {
    console.error(`[marketdata] ${sym} bundle 失败:`, e instanceof Error ? e.message : e);
  }

  // Exa 语义新闻增强(可选):合并去重,provider 自带优先、Exa 后补,封顶 5 条。
  if (exaConfigured()) {
    const extra = await exaNews(data.profile?.name || sym, 3);
    if (extra.length) {
      const seen = new Set((data.news ?? []).map((n) => n.headline));
      data.news = [...(data.news ?? []), ...extra.filter((n) => !seen.has(n.headline))].slice(0, 5);
    }
  }

  // 学到 profile 就回填 security(供图谱/详情展示名称、行业)
  if (data.profile?.name) {
    await prisma.security
      .update({ where: { symbol: sym }, data: { name: data.profile.name, exchange: data.profile.exchange, sector: data.profile.sector } })
      .catch(() => {});
  }
  return data;
}

// 带分类缓存的外部数据聚合：bundle(分钟级) + sentiment(按天) + events(按天)。
// 各 provider 未配 key 即跳过(零成本、加 key 立即激活)；任一失败不影响其它(降级)。
export async function getExternalDataCached(symbol: string): Promise<ExternalData> {
  const sym = symbol.replace(/^\$/, "").toUpperCase();

  // 先确保 security 存在(所有分类缓存写入的 FK)
  await prisma.security.upsert({ where: { symbol: sym }, create: { symbol: sym }, update: {} });

  const bundleTtl = Number(process.env.MARKETDATA_TTL_MS ?? 600_000);
  const sentTtl = Number(process.env.SENTIMENT_TTL_MS ?? 43_200_000); // 12h:迁就 AV 25/day
  const evtTtl = Number(process.env.EVENTS_TTL_MS ?? 43_200_000); // 12h

  // 事件源:优先 Finnhub earnings(免费档含),FMP 仅作降级(其免费档不含财报)
  const eventsFetcher = finnhubConfigured()
    ? () => finnhubEarnings(sym)
    : fmpConfigured()
      ? () => fmpEvents(sym)
      : null;

  const [bundle, sentiment, events] = await Promise.all([
    cachedCategory<ExternalData>(sym, "bundle", bundleTtl, () => fetchBundle(sym)),
    alphaVantageConfigured() ? cachedCategory(sym, "sentiment", sentTtl, () => avSentiment(sym)) : Promise.resolve(null),
    eventsFetcher ? cachedCategory(sym, "events", evtTtl, eventsFetcher) : Promise.resolve(null),
  ]);

  const result: ExternalData = { ...(bundle ?? {}) };
  // 缓存里空对象({})不是有效情绪/事件 → 只在有内容时挂上
  if (sentiment && typeof (sentiment as { score?: unknown }).score === "number") result.sentiment = sentiment as ExternalData["sentiment"];
  if (Array.isArray(events) && events.length) result.events = events as ExternalData["events"];
  return result;
}

export type { ExternalData } from "./types";
