import { createHash } from "node:crypto";
import Parser from "rss-parser";
import type { Connector, InfluencerSource, NormalizedPost, FetchResult } from "./types";
import { hostResolvesPublic } from "../ssrf";

// 默认抓取适配器：把任意 RSS（RSSHub / Nitter / Substack / 新闻源）拉成规范化帖子。
// sourceConfig 两种写法：
//   { connector: "rss", feedUrl: "https://...绝对地址" }            // 任意可直连 RSS
//   { connector: "rss", feedPath: "/twitter/user/serenity" }       // 经自建 RSSHub（RSSHUB_BASE_URL）解析
// feedPath 把「源路由」与「RSSHub 实例地址」解耦：换实例只需改 RSSHUB_BASE_URL，无需重新 seed。
const parser = new Parser({
  timeout: 15000,
  headers: { "User-Agent": "Mozilla/5.0 (compatible; X2T/1.0; +https://github.com/actionow-ai/x2t)" },
});

function resolveFeedUrl(source: InfluencerSource): { url: string; viaHub: boolean } | undefined {
  const cfg = source.sourceConfig;
  const explicit = cfg.feedUrl as string | undefined;
  if (explicit) return { url: explicit, viaHub: false };
  const path = cfg.feedPath as string | undefined;
  if (!path || !path.startsWith("/") || path.startsWith("//")) return undefined;
  const base = process.env.RSSHUB_BASE_URL || "http://localhost:51200";
  try {
    const u = new URL(path, base);
    // 解析后 origin 必须仍等于 base 的 origin:防 tab/反斜杠/编码把 host/端口/协议覆盖到内网元数据(sec-3)。
    if (u.origin !== new URL(base).origin) return undefined;
    return { url: u.toString(), viaHub: true };
  } catch {
    return undefined;
  }
}

export const rssConnector: Connector = {
  kind: "rss",

  async fetch(source: InfluencerSource): Promise<FetchResult> {
    const resolved = resolveFeedUrl(source);
    if (!resolved) {
      throw new Error(`博主 ${source.handle} 缺少合法 sourceConfig.feedUrl 或 feedPath`);
    }
    // 显式 feedUrl 必须是公网 http(s)(防 sourceConfig 指向内网元数据);经 RSSHub 的信任配置 base 不另检。
    if (!resolved.viaHub) {
      const u = new URL(resolved.url);
      if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("unsupported feed protocol");
      if (!(await hostResolvesPublic(u.hostname))) throw new Error("feed host not allowed");
    }

    const feed = await parser.parseURL(resolved.url);
    const posts: NormalizedPost[] = [];

    for (const item of feed.items) {
      const contentText = (item.contentSnippet ?? item.content ?? item.title ?? "").trim();
      if (!contentText) continue;

      // 去重键:优先 guid/link;都缺时用正文稳定 hash —— 不依赖易变的 pubDate 文本格式(RSSHub 实例/时区切换会改格式 → 旧版同帖去重键漂移造重复)
      const platformPostId = item.guid ?? item.link ?? `h:${createHash("sha1").update(contentText).digest("hex").slice(0, 24)}`;

      // postedAt 是"最新立场/转向"的时间命脉:无可信日期就跳过该 item,绝不用 now() 兜底
      // (否则旧帖被当成全站最新,污染共识与转向判定)
      const iso = item.isoDate ?? item.pubDate;
      if (!iso) continue;
      const postedAt = new Date(iso);
      if (Number.isNaN(postedAt.getTime())) continue;

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
