import { prisma } from "./db";
import { toQuoteSymbol } from "./symbol";

// 免费历史日线(无需 key)。供博主历史胜率回算。
// 多源:Yahoo chart(JSON,覆盖美/港/A 股/加密)为主 + Stooq CSV 兜底。
// 关键(统计审计 P0-1/P1-6):取【复权】收盘(adjclose,含拆股+分红),且回填用整段【原子覆盖】而非 skipDuplicates——
// 否则拆股后 Yahoo 重述历史无法传播进库,旧标度残留会造成 ±90% 级假收益且永不自愈。
// 本地开发 sandbox 无真实网络,二者都会失败 → 优雅降级(胜率为空,不报错);生产(Zeabur)有真网络。
const TIMEOUT = () => AbortSignal.timeout(Number(process.env.PRICE_TIMEOUT_MS ?? 10_000));
const UA = "Mozilla/5.0 (compatible; X2T/1.0; +https://x2t.actionow.ai)";
const RANGE = process.env.PRICE_RANGE ?? "2y"; // 历史窗口越长,能结算越早的 call(降低左删失)
const STOOQ_DAYS = Number(process.env.PRICE_STOOQ_DAYS ?? 740);

type Daily = { date: string; close: number };

// Yahoo Finance chart API:复权收盘(adjclose)优先,缺失回退原始 close。覆盖全球标的与加密(-USD)。
async function fetchYahooDaily(quoteSymbol: string): Promise<Daily[]> {
  try {
    const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(quoteSymbol)}?range=${RANGE}&interval=1d`, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: TIMEOUT(),
    });
    if (!res.ok) return [];
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("json")) return []; // 反爬挑战页等 → 放弃
    const j = (await res.json()) as {
      chart?: {
        result?: { timestamp?: number[]; indicators?: { quote?: { close?: (number | null)[] }[]; adjclose?: { adjclose?: (number | null)[] }[] } }[];
      };
    };
    const r = j?.chart?.result?.[0];
    const ts = r?.timestamp ?? [];
    const adj = r?.indicators?.adjclose?.[0]?.adjclose;
    const quote = r?.indicators?.quote?.[0]?.close ?? [];
    const series = adj && adj.length === ts.length ? adj : quote; // adjclose 含拆股+分红复权;长度不符则退回原始
    const out: Daily[] = [];
    for (let i = 0; i < ts.length; i++) {
      const c = series[i];
      if (typeof c === "number" && c > 0 && c < 1e7) out.push({ date: new Date(ts[i] * 1000).toISOString().slice(0, 10), close: c });
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
    const res = await fetch(`https://stooq.com/q/d/l/?s=${s}&d1=${ymd(new Date(Date.now() - STOOQ_DAYS * 86_400_000))}&d2=${ymd(new Date())}&i=d`, {
      signal: TIMEOUT(),
    });
    if (!res.ok) return [];
    const csv = await res.text();
    if (!csv.startsWith("Date")) return [];
    const out: Daily[] = [];
    for (const line of csv.trim().split("\n").slice(1)) {
      const c = line.split(",");
      const close = Number(c[4]);
      if (c[0] && Number.isFinite(close) && close > 0 && close < 1e7) out.push({ date: c[0], close });
    }
    return out;
  } catch {
    return [];
  }
}

// 单标的历史日线:加密映射到 -USD 走 Yahoo;美股 Yahoo 优先、空则 Stooq 兜底。
// 同一标的同一次回填只采【单一来源】(不混 Yahoo/Stooq,避免接缝处标度错位)。
export async function fetchDaily(symbol: string): Promise<Daily[]> {
  const y = await fetchYahooDaily(toQuoteSymbol(symbol));
  if (y.length) return y;
  return fetchStooqDaily(symbol);
}

// 回填一批标的的复权日线到 PriceDaily。
// 整段【原子覆盖】(deleteMany+createMany 同事务):每个标的库里始终是最近一次抓取的单源单标度窗口,
// 拆股后的历史重述能传播进库,根除"skipDuplicates 永不修正"的假收益。失败标的返回供观测(运维 H6)。
export async function backfillPrices(symbols: string[]): Promise<{ symbols: number; rows: number; failed: string[] }> {
  let rows = 0;
  let ok = 0;
  const failed: string[] = [];
  for (const sym of [...new Set(symbols)]) {
    const data = await fetchDaily(sym);
    if (!data.length) {
      failed.push(sym);
      continue;
    }
    const res = await prisma.$transaction([
      prisma.priceDaily.deleteMany({ where: { symbol: sym } }),
      prisma.priceDaily.createMany({ data: data.map((d) => ({ symbol: sym, date: new Date(d.date), close: d.close })) }),
    ]);
    rows += res[1].count;
    ok++;
  }
  return { symbols: ok, rows, failed };
}
