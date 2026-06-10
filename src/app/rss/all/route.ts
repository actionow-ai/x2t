import { prisma } from "@/lib/db";
import { buildRss, postToItem } from "@/lib/rss";
import { baseUrl } from "@/lib/base-url";

export const dynamic = "force-dynamic";

// 全站 RSS：/rss/all
// 可组合订阅(语义明确,供量化/筛选工作流):
//   ?sig=1     只保留 overallStance ∈ {bullish,bearish} 的帖
//   ?conf=0.7  整帖级 confidence >= 0.7(含等于;按 PostAnalysis.confidence,非单 ticker 级)
// 结构化字段:<x2t:stance> <x2t:confidence> 每 ticker <x2t:ticker>;
//   <x2t:divergence>true</> 仅当某 ticker 立场与新闻情绪相悖时出现——依赖已配 ALPHAVANTAGE_API_KEY(无情绪源则永不触发)。
//   立场翻转事件请订阅 /rss/flips(带 <x2t:flip from to>)。
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
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      // RSS 阅读器高频轮询:补与 /rss/flips 一致的缓存头,CDN/浏览器吃量,别持续打单容器(perf-2)
      "Cache-Control": "public, max-age=120, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
