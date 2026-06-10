import { prisma } from "@/lib/db";
import { buildRss, postToItem } from "@/lib/rss";
import { baseUrl } from "@/lib/base-url";

export const dynamic = "force-dynamic";

// 单博主 RSS：/i/{handle}/rss
export async function GET(request: Request, { params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const origin = baseUrl(request);

  const influencer = await prisma.influencer.findFirst({
    where: { handle },
    include: {
      posts: {
        orderBy: { postedAt: "desc" },
        take: 50,
        include: { influencer: true, analysis: true, tickers: { select: { symbol: true, stance: true } } },
      },
    },
  });
  if (!influencer) return new Response("Not found", { status: 404 });

  const name = influencer.displayName ?? influencer.handle;
  const xml = buildRss({
    title: `X2T · ${name}`,
    description: `${name}（@${influencer.handle}）的信号流 · 非投资建议`,
    selfUrl: `${origin}/i/${handle}/rss`,
    siteUrl: `${origin}/i/${handle}`,
    items: influencer.posts.map((p) => postToItem(p, origin)),
  });

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=120, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
