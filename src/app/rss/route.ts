import { prisma } from "@/lib/db";
import { buildRss, postToItem } from "@/lib/rss";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

// 自定义组合 RSS：/rss?influencers=serenity,marcotrades
// 注：?tickers=NVDA 形式需要 post_tickers（M3 接入），本切片先支持按博主组合。
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;

  const influencersParam = url.searchParams.get("influencers");
  const handles = influencersParam
    ? influencersParam.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const where: Prisma.PostWhereInput = handles.length
    ? { influencer: { handle: { in: handles } } }
    : {};

  const posts = await prisma.post.findMany({
    where,
    orderBy: { postedAt: "desc" },
    take: 100,
    include: { influencer: true, analysis: true },
  });

  const title = handles.length
    ? `X2T · 自定义组合（${handles.join(", ")}）`
    : "X2T · 自定义组合";

  const xml = buildRss({
    title,
    description: "自定义组合信号流 · 非投资建议",
    selfUrl: url.toString(),
    siteUrl: origin,
    items: posts.map((p) => postToItem(p, origin)),
  });

  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
