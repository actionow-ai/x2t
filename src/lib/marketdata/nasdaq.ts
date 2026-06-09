import { readFileSync, writeFileSync } from "node:fs";
import type { MarketEvent } from "./types";

// Nasdaq 免费财报日历(无 key,需浏览器 UA)。per-symbol 端点只给预测,故用 by-date 端点:
// worker 每日拉未来 N 天日历,聚成 {symbol: 最早财报日} 全局 map,写共享 /tmp 文件(web+worker 同容器),
// 查询时读文件即可(避开 externalDataCache 的 Security 外键约束、零额外表)。
const MAP_FILE = process.env.NASDAQ_EARNINGS_FILE || "/tmp/x2t-nasdaq-earnings.json";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";

export function nasdaqEnabled(): boolean {
  return process.env.EVENTS_NASDAQ === "1";
}

// 构建并落盘 symbol→财报日 map;返回标的数。仅 worker 每日调用。
export async function buildNasdaqEarningsMap(days = Number(process.env.NASDAQ_EARNINGS_DAYS ?? 35)): Promise<number> {
  const map: Record<string, string> = {};
  const base = Date.now();
  for (let i = 0; i < days; i++) {
    const ds = new Date(base + i * 86_400_000).toISOString().slice(0, 10);
    try {
      const res = await fetch(`https://api.nasdaq.com/api/calendar/earnings?date=${ds}`, {
        headers: { "User-Agent": UA, Accept: "application/json, text/plain, */*" },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) continue;
      const j = (await res.json()) as { data?: { rows?: Array<{ symbol?: string }> } };
      for (const r of j?.data?.rows ?? []) {
        const s = String(r?.symbol ?? "").toUpperCase().trim();
        if (s && !map[s]) map[s] = ds; // 最早一档
      }
    } catch {
      /* 跳过该日 */
    }
  }
  try {
    writeFileSync(MAP_FILE, JSON.stringify({ at: base, map }));
  } catch {
    /* ignore */
  }
  return Object.keys(map).length;
}

// 从落盘 map 查某标的的下次财报(同步读文件);未启用/无文件/未命中 → []。
export function nasdaqEventsFromMap(symbol: string): MarketEvent[] {
  if (!nasdaqEnabled()) return [];
  try {
    const { map } = JSON.parse(readFileSync(MAP_FILE, "utf8")) as { map: Record<string, string> };
    const date = map[symbol.toUpperCase()];
    return date ? [{ type: "earnings", date, title: "Earnings" }] : [];
  } catch {
    return [];
  }
}
