import { prisma } from "@/lib/db";

type Item = { symbol: string; stance: string; price?: number; changePct?: number };

// 顶部滚动行情带：取最近被点评的标的 + 缓存价格。
export async function TickerTape() {
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

  if (items.length === 0) {
    return (
      <div className="ticker">
        <div className="ticker-empty">// AWAITING SIGNALS — 跑 pnpm poll:once &amp;&amp; pnpm analyze:once</div>
      </div>
    );
  }

  const loop = [...items, ...items];
  return (
    <div className="ticker" aria-hidden="true">
      <div className="ticker-track">
        {loop.map((it, i) => {
          const arrow = it.stance === "bullish" ? "▲" : it.stance === "bearish" ? "▼" : "■";
          const dir = it.changePct === undefined ? (it.stance === "bullish" ? "up" : it.stance === "bearish" ? "dn" : "") : it.changePct >= 0 ? "up" : "dn";
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
