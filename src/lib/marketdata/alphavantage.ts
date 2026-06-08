import type { Sentiment } from "./types";

// Alpha Vantage NEWS_SENTIMENT：给某标的的"新闻情绪分"维度。
// 免费档 25 次/天极紧 → 由调用方按天缓存(SENTIMENT_TTL_MS)、仅对真实标的取。
// 未配置 ALPHAVANTAGE_API_KEY → 返回 null,调用方自然降级(不输出情绪维度)。
export function alphaVantageConfigured(): boolean {
  return !!process.env.ALPHAVANTAGE_API_KEY;
}

// AV 五档文字标签(官方区间)。
function avLabel(s: number): string {
  if (s <= -0.35) return "Bearish";
  if (s <= -0.15) return "Somewhat-Bearish";
  if (s < 0.15) return "Neutral";
  if (s < 0.35) return "Somewhat-Bullish";
  return "Bullish";
}

export async function avSentiment(symbol: string): Promise<Sentiment | null> {
  const key = process.env.ALPHAVANTAGE_API_KEY;
  if (!key) return null;
  try {
    const url = `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=${encodeURIComponent(symbol)}&limit=50&apikey=${key}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(Number(process.env.MARKETDATA_HTTP_TIMEOUT_MS ?? 10000)) });
    if (!res.ok) throw new Error(`alphavantage ${res.status}`);
    // 额度耗尽/限频时 AV 返回 {Information|Note: "..."} 而非 feed → 无 feed 即降级
    const json = (await res.json()) as {
      feed?: Array<{ ticker_sentiment?: Array<{ ticker?: string; ticker_sentiment_score?: string; relevance_score?: string }> }>;
    };
    if (!Array.isArray(json.feed)) return null;

    // 该 ticker 的情绪分,按相关度加权平均
    const sym = symbol.toUpperCase();
    let wsum = 0;
    let w = 0;
    let n = 0;
    for (const f of json.feed) {
      const ts = (f.ticker_sentiment ?? []).find((t) => (t.ticker ?? "").toUpperCase() === sym);
      if (!ts) continue;
      const score = Number(ts.ticker_sentiment_score);
      const rel = Number(ts.relevance_score);
      if (!Number.isFinite(score)) continue;
      const weight = Number.isFinite(rel) && rel > 0 ? rel : 1;
      wsum += score * weight;
      w += weight;
      n++;
    }
    if (n === 0 || w === 0) return null;
    const score = Math.round((wsum / w) * 1000) / 1000;
    return { score, label: avLabel(score), articleCount: n, source: "alphavantage" };
  } catch (e) {
    console.error(`[alphavantage] ${symbol} 失败:`, e instanceof Error ? e.message : e);
    return null;
  }
}
