import type { MarketDataProvider, ExternalData, NewsItem, MarketEvent } from "./types";

export function finnhubConfigured(): boolean {
  return !!process.env.FINNHUB_API_KEY;
}

// Finnhub 财报日历（免费档含！FMP 免费档不含财报，故事件维度改由 Finnhub 出）。
// 取未来 ~120 天内最近一次财报日。失败/无数据 → []。
export async function finnhubEarnings(symbol: string): Promise<MarketEvent[]> {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) return [];
  try {
    const from = new Date().toISOString().slice(0, 10);
    const to = new Date(Date.now() + 120 * 86_400_000).toISOString().slice(0, 10);
    const res = await fetch(
      `https://finnhub.io/api/v1/calendar/earnings?from=${from}&to=${to}&symbol=${encodeURIComponent(symbol)}&token=${key}`,
      { signal: AbortSignal.timeout(Number(process.env.MARKETDATA_HTTP_TIMEOUT_MS ?? 10000)) },
    );
    if (!res.ok) throw new Error(`finnhub earnings ${res.status}`);
    const json = (await res.json()) as { earningsCalendar?: Array<{ date?: string; epsEstimate?: number | null }> };
    const next = (json.earningsCalendar ?? [])
      .filter((r) => r.date)
      .sort((a, b) => (a.date! < b.date! ? -1 : 1))[0];
    if (!next?.date) return [];
    const eps = next.epsEstimate != null ? ` (EPS est ${next.epsEstimate})` : "";
    return [{ type: "earnings", date: next.date, title: `Earnings${eps}` }];
  } catch (e) {
    console.error(`[finnhub] ${symbol} earnings 失败:`, e instanceof Error ? e.message : e);
    return [];
  }
}

// Finnhub 适配器（免费档：quote / profile2 / company-news）。
export function createFinnhub(apiKey: string): MarketDataProvider {
  const base = "https://finnhub.io/api/v1";

  async function getJson(url: string): Promise<unknown> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`finnhub ${res.status}`);
    return res.json();
  }

  return {
    name: "finnhub",
    async getExternalData(symbol: string): Promise<ExternalData> {
      const data: ExternalData = {};
      const tok = `token=${apiKey}`;
      const sym = encodeURIComponent(symbol);

      try {
        const q = (await getJson(`${base}/quote?symbol=${sym}&${tok}`)) as { c?: number; dp?: number };
        if (typeof q.c === "number" && q.c > 0) data.quote = { price: q.c, changePct: q.dp ?? 0 };
      } catch {
        /* 单项失败不影响其他 */
      }

      try {
        const p = (await getJson(`${base}/stock/profile2?symbol=${sym}&${tok}`)) as {
          name?: string;
          exchange?: string;
          finnhubIndustry?: string;
          marketCapitalization?: number;
        };
        if (p && p.name) {
          data.profile = {
            name: p.name,
            exchange: p.exchange,
            sector: p.finnhubIndustry,
            marketCap: p.marketCapitalization,
          };
        }
      } catch {
        /* ignore */
      }

      try {
        const to = new Date().toISOString().slice(0, 10);
        const from = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
        const news = (await getJson(`${base}/company-news?symbol=${sym}&from=${from}&to=${to}&${tok}`)) as Array<{
          headline?: string;
          url?: string;
        }>;
        if (Array.isArray(news)) {
          data.news = news
            .slice(0, 3)
            .map((n): NewsItem => ({ headline: n.headline ?? "", url: n.url }))
            .filter((n) => n.headline);
        }
      } catch {
        /* ignore */
      }

      return data;
    },
  };
}
