import type { MarketEvent } from "./types";

// Financial Modeling Prep：给某标的的"事件日历"维度(当前取即将到来的财报日)。
// 免费档 250 次/天 → 由调用方按天缓存(EVENTS_TTL_MS)。
// 未配置 FMP_API_KEY → 返回 [],调用方自然降级。免费档拿不到的标的(非美股等)会返回非数组 → 同样降级为 []。
export function fmpConfigured(): boolean {
  return !!process.env.FMP_API_KEY;
}

export async function fmpEvents(symbol: string): Promise<MarketEvent[]> {
  const key = process.env.FMP_API_KEY;
  if (!key) return [];
  const events: MarketEvent[] = [];
  const timeout = Number(process.env.MARKETDATA_HTTP_TIMEOUT_MS ?? 10000);
  const sinceMs = Date.now() - 86_400_000; // 含今天

  try {
    const res = await fetch(
      `https://financialmodelingprep.com/api/v3/historical/earning_calendar/${encodeURIComponent(symbol)}?apikey=${key}`,
      { signal: AbortSignal.timeout(timeout) },
    );
    if (res.ok) {
      const rows = (await res.json()) as Array<{ date?: string; epsEstimated?: number | null; revenueEstimated?: number | null }>;
      if (Array.isArray(rows)) {
        const upcoming = rows
          .filter((r) => r.date && new Date(r.date).getTime() >= sinceMs)
          .sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime())[0];
        if (upcoming?.date) {
          const eps = upcoming.epsEstimated != null ? ` (EPS est ${upcoming.epsEstimated})` : "";
          events.push({ type: "earnings", date: upcoming.date, title: `Earnings${eps}` });
        }
      }
    }
  } catch (e) {
    console.error(`[fmp] ${symbol} earnings 失败:`, e instanceof Error ? e.message : e);
  }

  return events;
}
