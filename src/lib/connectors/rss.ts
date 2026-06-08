import Parser from "rss-parser";
import type { Connector, InfluencerSource, NormalizedPost, FetchResult } from "./types";

// 默认抓取适配器：把任意 RSS（RSSHub / Nitter / Substack / 新闻源）拉成规范化帖子。
// sourceConfig: { connector: "rss", feedUrl: string }
const parser = new Parser({ timeout: 15000 });

export const rssConnector: Connector = {
  kind: "rss",

  async fetch(source: InfluencerSource): Promise<FetchResult> {
    const feedUrl = source.sourceConfig.feedUrl as string | undefined;
    if (!feedUrl) {
      throw new Error(`博主 ${source.handle} 缺少 sourceConfig.feedUrl`);
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
