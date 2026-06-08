import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { SITE_URL } from "@/lib/seo";

export const revalidate = 3600; // 每小时再生,避免每次请求都打 DB

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = ["", "/graph", "/following", "/submit", "/login"].map((p) => ({
    url: `${SITE_URL}${p}`,
    lastModified: new Date(),
    changeFrequency: "daily",
    priority: p === "" ? 1 : 0.7,
  }));

  try {
    const [posts, influencers, securities] = await Promise.all([
      prisma.post.findMany({ where: { analysisStatus: "done" }, select: { id: true, postedAt: true }, orderBy: { postedAt: "desc" }, take: 2000 }),
      prisma.influencer.findMany({ where: { active: true }, select: { handle: true } }),
      prisma.postTicker.findMany({ select: { symbol: true }, distinct: ["symbol"], take: 1000 }),
    ]);
    return [
      ...staticRoutes,
      ...posts.map((p) => ({ url: `${SITE_URL}/p/${p.id}`, lastModified: p.postedAt, changeFrequency: "weekly" as const, priority: 0.5 })),
      ...influencers.map((i) => ({ url: `${SITE_URL}/i/${encodeURIComponent(i.handle)}`, changeFrequency: "daily" as const, priority: 0.6 })),
      ...securities.map((s) => ({ url: `${SITE_URL}/t/${encodeURIComponent(s.symbol)}`, changeFrequency: "daily" as const, priority: 0.5 })),
    ];
  } catch {
    return staticRoutes; // DB 异常时至少给出静态页
  }
}
