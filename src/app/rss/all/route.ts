import { prisma } from "@/lib/db";
import { buildRss, postToItem } from "@/lib/rss";
import { baseUrl } from "@/lib/base-url";

export const dynamic = "force-dynamic";

// 全站 RSS：/rss/all
// 可组合订阅:?sig=1 只看有多空观点的帖;?conf=0.7 最低置信度阈值(供量化/筛选工作流)。
export async function GET(request: Request) {
  const origin = baseUrl(request);
  const sp = new URL(request.url).searchParams;
  const onlySignal = sp.get("sig") === "1";
  const minConf = Number(sp.get("conf"));

  const analysisFilter: Record<string, unknown> = {};
  if (onlySignal) analysisFilter.overallStance = { in: ["bullish", "bearish"] };
  if (Number.isFinite(minConf) && minConf > 0) analysisFilter.confidence = { gte: minConf };

  const posts = await prisma.post.findMany({
    where: Object.keys(analysisFilter).length ? { analysis: analysisFilter } : undefined,
    orderBy: { postedAt: "desc" },
    take: 100,
    include: { influencer: true, analysis: true, tickers: { select: { symbol: true, stance: true } } },
  });

  // T2.4 背离:批量取这些标的的新闻情绪,标出"博主立场与市场情绪相悖"的帖(x2t:divergence)
  const symbols = [...new Set(posts.flatMap((p) => p.tickers.map((t) => t.symbol)))];
  const sentBy = new Map<string, number>();
  if (symbols.length) {
    const rows = await prisma.externalDataCache.findMany({
      where: { symbol: { in: symbols }, dataType: "sentiment" },
      orderBy: { fetchedAt: "desc" },
      select: { symbol: true, payload: true },
    });
    for (const r of rows) {
      if (sentBy.has(r.symbol)) continue;
      const s = (r.payload as { score?: number } | null)?.score;
      if (typeof s === "number") sentBy.set(r.symbol, s);
    }
  }
  const diverges = (p: (typeof posts)[number]) =>
    p.tickers.some((t) => {
      const sc = sentBy.get(t.symbol);
      return sc !== undefined && ((t.stance === "bullish" && sc <= -0.15) || (t.stance === "bearish" && sc >= 0.15));
    });

  const self = `${origin}/rss/all${sp.toString() ? `?${sp.toString()}` : ""}`;
  const xml = buildRss({
    title: "X2T · 全站信号流",
    description: "所有博主的最新信号 · 非投资建议",
    selfUrl: self,
    siteUrl: origin,
    items: posts.map((p) => postToItem(p, origin, diverges(p))),
  });

  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
