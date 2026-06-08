import { prisma } from "../db";
import type { MarketDataProvider, ExternalData } from "./types";
import { createMockMarketData } from "./mock";
import { createFinnhub } from "./finnhub";
import { exaConfigured, exaNews } from "./exa";

export function getMarketDataProvider(): MarketDataProvider {
  const key = process.env.FINNHUB_API_KEY;
  return key ? createFinnhub(key) : createMockMarketData();
}

// 带缓存的外部数据获取：external_data_cache TTL 内复用，控成本、不重复拉。
export async function getExternalDataCached(symbol: string): Promise<ExternalData> {
  const sym = symbol.replace(/^\$/, "").toUpperCase();

  const cached = await prisma.externalDataCache.findFirst({
    where: { symbol: sym, dataType: "bundle", expiresAt: { gt: new Date() } },
    orderBy: { fetchedAt: "desc" },
  });
  if (cached) return cached.payload as ExternalData;

  const provider = getMarketDataProvider();
  let data: ExternalData = {};
  try {
    data = await provider.getExternalData(sym);
  } catch (e) {
    console.error(`[marketdata] ${sym} 获取失败:`, e instanceof Error ? e.message : e);
  }

  // Exa 语义新闻增强(可选,有免费额度):合并去重,优先保留 provider 自带后补 Exa,封顶 5 条。
  if (exaConfigured()) {
    const extra = await exaNews(data.profile?.name || sym, 3);
    if (extra.length) {
      const seen = new Set((data.news ?? []).map((n) => n.headline));
      data.news = [...(data.news ?? []), ...extra.filter((n) => !seen.has(n.headline))].slice(0, 5);
    }
  }

  const ttlMs = Number(process.env.MARKETDATA_TTL_MS ?? 600_000);
  // external_data_cache.symbol FK → 先确保 security 存在
  await prisma.security.upsert({
    where: { symbol: sym },
    create: { symbol: sym, name: data.profile?.name, exchange: data.profile?.exchange, sector: data.profile?.sector },
    update: data.profile?.name
      ? { name: data.profile.name, exchange: data.profile.exchange, sector: data.profile.sector }
      : {},
  });
  await prisma.externalDataCache.create({
    data: { symbol: sym, dataType: "bundle", payload: data as object, expiresAt: new Date(Date.now() + ttlMs) },
  });

  return data;
}

export type { ExternalData } from "./types";
