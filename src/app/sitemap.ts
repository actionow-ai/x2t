import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { SITE_URL } from "@/lib/seo";

export const revalidate = 3600; // 每小时再生,避免每次请求都打 DB

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // 收录公开内容页 + 战绩榜;排除登录态/私有页(/login /following /submit /alerts 由 robots disallow)。
  const staticRoutes: MetadataRoute.Sitemap = ["", "/graph", "/leaderboard", "/about"].map((p) => ({
    url: `${SITE_URL}${p}`,
    lastModified: new Date(),
    changeFrequency: "daily",
    priority: p === "" ? 1 : 0.7,
  }));

  try {
    const [posts, influencers, securities] = await Promise.all([
      prisma.post.findMany({ where: { analysisStatus: "done", influencer: { platform: { not: "manual" } } }, select: { id: true, postedAt: true }, orderBy: { postedAt: "desc" }, take: 2000 }),
      prisma.influencer.findMany({ where: { active: true, optedOut: false }, select: { handle: true } }),
      prisma.postTicker.findMany({ select: { symbol: true }, distinct: ["symbol"], take: 1000 }),
    ]);
    return [
      ...staticRoutes,
      ...posts.map((p) => ({ url: `${SITE_URL}/p/${p.id}`, lastModified: p.postedAt, changeFrequency: "weekly" as const, priority: 0.5 })),
      ...influencers.map((i) => ({ url: `${SITE_URL}/i/${encodeURIComponent(i.handle)}`, lastModified: new Date(), changeFrequency: "daily" as const, priority: 0.6 })),
      ...securities.map((s) => ({ url: `${SITE_URL}/t/${encodeURIComponent(s.symbol)}`, lastModified: new Date(), changeFrequency: "daily" as const, priority: 0.5 })),
    ];
  } catch {
    return staticRoutes; // DB 异常时至少给出静态页
  }
}
