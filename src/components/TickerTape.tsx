import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/i18n-server";
import { getDict } from "@/lib/i18n";

type Item = { symbol: string; stance: string; price?: number; changePct?: number };

// 行情带数据：进程级数据缓存 60s,避免全站每次导航都打 DB(TickerTape 在 root layout)。
const getTickerItems = unstable_cache(
  async (): Promise<Item[]> => {
    const rows = await prisma.postTicker.findMany({
      orderBy: { post: { postedAt: "desc" } },
      take: 40,
      select: { symbol: true, stance: true },
    });
    const seen = new Set<string>();
    const items: Item[] = [];
    for (const r of rows) {
      if (seen.has(r.symbol)) continue;
      seen.add(r.symbol);
      items.push({ symbol: r.symbol, stance: r.stance });
      if (items.length >= 14) break;
    }
    if (items.length > 0) {
      const caches = await prisma.externalDataCache.findMany({
        where: { symbol: { in: items.map((i) => i.symbol) }, dataType: "bundle" },
        orderBy: { fetchedAt: "desc" },
        select: { symbol: true, payload: true },
      });
      const priceBy = new Map<string, { price?: number; changePct?: number }>();
      for (const c of caches) {
        if (priceBy.has(c.symbol)) continue;
        const q = (c.payload as { quote?: { price?: number; changePct?: number } } | null)?.quote;
        if (q) priceBy.set(c.symbol, { price: q.price, changePct: q.changePct });
      }
      for (const it of items) {
        const p = priceBy.get(it.symbol);
        if (p) {
          it.price = p.price;
          it.changePct = p.changePct;
        }
      }
    }
    return items;
  },
  ["ticker-tape"],
  { revalidate: 60 },
);

// 顶部行情带：重复填满整宽 + 无缝循环。
export async function TickerTape() {
  const items = await getTickerItems();

  if (items.length === 0) {
    const t = getDict(await getLocale());
    return (
      <div className="ticker">
        <div className="ticker-empty">{t.common.loading}</div>
      </div>
    );
  }

  // 重复到至少 16 条作为「一组」，整组渲染两遍 → translateX(-50%) 无缝循环，且填满整宽
  const repeats = Math.max(2, Math.ceil(16 / items.length));
  const group = Array.from({ length: repeats }).flatMap(() => items);
  const loop = [...group, ...group];

  return (
    <div className="ticker" aria-hidden="true">
      <div className="ticker-track">
        {loop.map((it, i) => {
          const dir =
            it.changePct === undefined
              ? it.stance === "bullish"
                ? "up"
                : it.stance === "bearish"
                  ? "dn"
                  : ""
              : it.changePct >= 0
                ? "up"
                : "dn";
          const arrow = dir === "up" ? "▲" : dir === "dn" ? "▼" : "·";
          const chg = it.changePct === undefined ? "" : `${it.changePct >= 0 ? "+" : ""}${it.changePct}%`;
          return (
            <span className="ticker-item" key={i}>
              <span className={dir}>{arrow}</span>
              <span className="sym">${it.symbol}</span>
              {it.price !== undefined && <span>{it.price}</span>}
              {chg && <span className={dir}>{chg}</span>}
            </span>
          );
        })}
      </div>
    </div>
  );
}
