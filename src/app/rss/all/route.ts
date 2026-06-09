import { prisma } from "@/lib/db";
import { buildRss, postToItem } from "@/lib/rss";
import { baseUrl } from "@/lib/base-url";

export const dynamic = "force-dynamic";

// 全站 RSS：/rss/all
export async function GET(request: Request) {
  const origin = baseUrl(request);

  const posts = await prisma.post.findMany({
    orderBy: { postedAt: "desc" },
    take: 100,
    include: { influencer: true, analysis: true, tickers: { select: { symbol: true, stance: true } } },
  });

  const xml = buildRss({
    title: "X2T · 全站信号流",
    description: "所有博主的最新信号 · 非投资建议",
    selfUrl: `${origin}/rss/all`,
    siteUrl: origin,
    items: posts.map((p) => postToItem(p, origin)),
  });

  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
