import { prisma } from "./db";

// 免费历史日线(无需 key)。供博主历史胜率回算。
// 多源:Yahoo chart(JSON,覆盖美/港/A 股)为主 + Stooq CSV 兜底。
// 注意:本地开发 sandbox 无真实网络,二者都会失败 → 优雅降级(胜率为空,不报错);生产(Zeabur)有真网络。
const TIMEOUT = () => AbortSignal.timeout(Number(process.env.PRICE_TIMEOUT_MS ?? 10_000));
const UA = "Mozilla/5.0 (compatible; X2T/1.0; +https://x2t.actionow.ai)";

type Daily = { date: string; close: number };

// Yahoo Finance chart API:返回 timestamp[] + close[],覆盖全球标的。
async function fetchYahooDaily(symbol: string): Promise<Daily[]> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=6mo&interval=1d`,
      { headers: { "User-Agent": UA, Accept: "application/json" }, signal: TIMEOUT() },
    );
    if (!res.ok) return [];
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("json")) return []; // 反爬挑战页等 → 放弃
    const j = (await res.json()) as {
      chart?: { result?: { timestamp?: number[]; indicators?: { quote?: { close?: (number | null)[] }[] } }[] };
    };
    const r = j?.chart?.result?.[0];
    const ts = r?.timestamp ?? [];
    const closes = r?.indicators?.quote?.[0]?.close ?? [];
    const out: Daily[] = [];
    for (let i = 0; i < ts.length; i++) {
      const c = closes[i];
      if (typeof c === "number" && c > 0) out.push({ date: new Date(ts[i] * 1000).toISOString().slice(0, 10), close: c });
    }
    return out;
  } catch {
    return [];
  }
}

// Stooq CSV 兜底(仅美股映射 symbol.us)。
const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");
async function fetchStooqDaily(symbol: string): Promise<Daily[]> {
  if (!/^[A-Z]{1,6}([.-][A-Z]{1,4})?$/.test(symbol)) return [];
  const s = `${symbol.toLowerCase().replace(/[.-]/g, "-")}.us`;
  try {
    const res = await fetch(`https://stooq.com/q/d/l/?s=${s}&d1=${ymd(new Date(Date.now() - 160 * 86_400_000))}&d2=${ymd(new Date())}&i=d`, {
      signal: TIMEOUT(),
    });
    if (!res.ok) return [];
    const csv = await res.text();
    if (!csv.startsWith("Date")) return [];
    const out: Daily[] = [];
    for (const line of csv.trim().split("\n").slice(1)) {
      const c = line.split(",");
      const close = Number(c[4]);
      if (c[0] && Number.isFinite(close) && close > 0) out.push({ date: c[0], close });
    }
    return out;
  } catch {
    return [];
  }
}

export async function fetchDaily(symbol: string): Promise<Daily[]> {
  const y = await fetchYahooDaily(symbol);
  if (y.length) return y;
  return fetchStooqDaily(symbol);
}

// 回填一批标的的日收盘到 PriceDaily(幂等:复合主键 skipDuplicates)。
export async function backfillPrices(symbols: string[]): Promise<{ symbols: number; rows: number }> {
  let rows = 0;
  let ok = 0;
  for (const sym of symbols) {
    const data = await fetchDaily(sym);
    if (!data.length) continue;
    const r = await prisma.priceDaily.createMany({
      data: data.map((d) => ({ symbol: sym, date: new Date(d.date), close: d.close })),
      skipDuplicates: true,
    });
    rows += r.count;
    ok++;
  }
  return { symbols: ok, rows };
}
