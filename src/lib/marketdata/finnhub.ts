import type { MarketDataProvider, ExternalData, NewsItem } from "./types";

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
