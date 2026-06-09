import { buildRss } from "@/lib/rss";
import { getRecentFlips } from "@/lib/stance";
import { baseUrl } from "@/lib/base-url";

export const dynamic = "force-dynamic";

// 立场转向事件流 /rss/flips —— 护城河信号的机读出口(每项带 <x2t:flip from to>),供量化/看板订阅。
const zh: Record<string, string> = { bullish: "看多", bearish: "看空", neutral: "中性" };

export async function GET(request: Request) {
  const origin = baseUrl(request);
  const flips = await getRecentFlips(50);

  const items = flips.map((f) => {
    const name = f.displayName ?? f.handle;
    return {
      title: `${name} 立场转向 $${f.symbol}: ${zh[f.prevStance] ?? f.prevStance}→${zh[f.stance] ?? f.stance}`,
      link: `${origin}/p/${f.postId}`,
      guid: `${f.postId}:${f.symbol}:flip`,
      pubDate: f.postedAt,
      description: `${name} 对 $${f.symbol} 的立场由${zh[f.prevStance] ?? f.prevStance}转为${zh[f.stance] ?? f.stance}。— 非投资建议`,
      author: name,
      stance: f.stance,
      tickers: [{ symbol: f.symbol, stance: f.stance }],
      flip: { symbol: f.symbol, prevStance: f.prevStance, newStance: f.stance },
    };
  });

  const xml = buildRss({
    title: "X2T · 立场转向流",
    description: "博主对个股的立场翻转事件 · 非投资建议",
    selfUrl: `${origin}/rss/flips`,
    siteUrl: origin,
    items,
  });

  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}
