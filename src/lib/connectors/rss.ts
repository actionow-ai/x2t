import Parser from "rss-parser";
import type { Connector, InfluencerSource, NormalizedPost, FetchResult } from "./types";

// 默认抓取适配器：把任意 RSS（RSSHub / Nitter / Substack / 新闻源）拉成规范化帖子。
// sourceConfig 两种写法：
//   { connector: "rss", feedUrl: "https://...绝对地址" }            // 任意可直连 RSS
//   { connector: "rss", feedPath: "/twitter/user/serenity" }       // 经自建 RSSHub（RSSHUB_BASE_URL）解析
// feedPath 把「源路由」与「RSSHub 实例地址」解耦：换实例只需改 RSSHUB_BASE_URL，无需重新 seed。
const parser = new Parser({
  timeout: 15000,
  headers: { "User-Agent": "Mozilla/5.0 (compatible; X2T/1.0; +https://github.com/actionow-ai/x2t)" },
});

function resolveFeedUrl(source: InfluencerSource): string | undefined {
  const cfg = source.sourceConfig;
  const explicit = cfg.feedUrl as string | undefined;
  if (explicit) return explicit;
  const path = cfg.feedPath as string | undefined;
  if (!path) return undefined;
  const base = process.env.RSSHUB_BASE_URL || "http://localhost:51200";
  return new URL(path, base).toString();
}

export const rssConnector: Connector = {
  kind: "rss",

  async fetch(source: InfluencerSource): Promise<FetchResult> {
    const feedUrl = resolveFeedUrl(source);
    if (!feedUrl) {
      throw new Error(`博主 ${source.handle} 缺少 sourceConfig.feedUrl 或 feedPath`);
    }

    const feed = await parser.parseURL(feedUrl);
    const posts: NormalizedPost[] = [];

    for (const item of feed.items) {
      const platformPostId = item.guid ?? item.link ?? (item.title && item.pubDate ? `${item.title}::${item.pubDate}` : undefined);
      if (!platformPostId) continue;

      const contentText = (item.contentSnippet ?? item.content ?? item.title ?? "").trim();
      if (!contentText) continue;

      const postedAt = item.isoDate
        ? new Date(item.isoDate)
        : item.pubDate
          ? new Date(item.pubDate)
          : new Date();

      posts.push({
        platformPostId,
        url: item.link,
        contentText,
        postedAt,
        raw: item,
      });
    }

    const avatarUrl =
      feed.image?.url ?? (feed as unknown as { itunes?: { image?: string } }).itunes?.image;
    return { posts, profile: avatarUrl ? { avatarUrl } : undefined };
  },
};
