// RSS 2.0 输出 —— 设计文档 §8。无第三方依赖，手搓 XML（带转义）。

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export type PostForRss = {
  id: string;
  contentText: string;
  url: string | null;
  postedAt: Date;
  influencer: { handle: string; displayName: string | null };
  analysis?: { summary: string } | null;
};

type RssItem = {
  title: string;
  link: string;
  guid: string;
  pubDate: Date;
  description: string;
  author: string;
};

export function postToItem(post: PostForRss, siteUrl: string): RssItem {
  const name = post.influencer.displayName ?? post.influencer.handle;
  const firstLine = post.contentText.split("\n")[0].slice(0, 80);
  const description = [
    post.contentText,
    post.analysis ? `\n\nAI 分析：${post.analysis.summary}` : "",
    "\n\n— 非投资建议",
  ].join("");
  return {
    title: `${name}: ${firstLine}`,
    link: post.url ?? `${siteUrl}/p/${post.id}`,
    guid: post.id,
    pubDate: post.postedAt,
    description,
    author: name,
  };
}

export function buildRss(opts: {
  title: string;
  description: string;
  selfUrl: string;
  siteUrl: string;
  items: RssItem[];
}): string {
  const items = opts.items
    .map(
      (it) => `
    <item>
      <title>${esc(it.title)}</title>
      <link>${esc(it.link)}</link>
      <guid isPermaLink="false">${esc(it.guid)}</guid>
      <pubDate>${it.pubDate.toUTCString()}</pubDate>
      <dc:creator>${esc(it.author)}</dc:creator>
      <description>${esc(it.description)}</description>
    </item>`,
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(opts.title)}</title>
    <link>${esc(opts.siteUrl)}</link>
    <atom:link href="${esc(opts.selfUrl)}" rel="self" type="application/rss+xml" />
    <description>${esc(opts.description)}</description>
    <language>zh-CN</language>
    <generator>X2T</generator>${items}
  </channel>
</rss>`;
}
