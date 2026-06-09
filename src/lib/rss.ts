// RSS 2.0 输出 —— 设计文档 §8。无第三方依赖，手搓 XML（带转义）。
// 除人类可读 description 外，附带 x2t: 命名空间的结构化字段(stance/confidence/ticker),供机器消费。

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
  analysis?: { summary: string; overallStance?: string; confidence?: number | null } | null;
  tickers?: { symbol: string; stance: string }[];
};

type RssItem = {
  title: string;
  link: string;
  guid: string;
  pubDate: Date;
  description: string;
  author: string;
  stance?: string;
  confidence?: number | null;
  tickers: { symbol: string; stance: string }[];
  divergence?: boolean;
  flip?: { symbol: string; prevStance: string; newStance: string };
};

export function postToItem(post: PostForRss, siteUrl: string, divergence = false): RssItem {
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
    stance: post.analysis?.overallStance,
    confidence: post.analysis?.confidence ?? null,
    tickers: post.tickers ?? [],
    divergence,
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
    .map((it) => {
      const struct = [
        it.stance ? `\n      <x2t:stance>${esc(it.stance)}</x2t:stance>` : "",
        typeof it.confidence === "number" ? `\n      <x2t:confidence>${it.confidence}</x2t:confidence>` : "",
        it.divergence ? `\n      <x2t:divergence>true</x2t:divergence>` : "",
        it.flip ? `\n      <x2t:flip symbol="${esc(it.flip.symbol)}" from="${esc(it.flip.prevStance)}" to="${esc(it.flip.newStance)}" />` : "",
        ...it.tickers.map((t) => `\n      <x2t:ticker symbol="${esc(t.symbol)}" stance="${esc(t.stance)}" />`),
      ].join("");
      return `
    <item>
      <title>${esc(it.title)}</title>
      <link>${esc(it.link)}</link>
      <guid isPermaLink="false">${esc(it.guid)}</guid>
      <pubDate>${it.pubDate.toUTCString()}</pubDate>
      <dc:creator>${esc(it.author)}</dc:creator>
      <description>${esc(it.description)}</description>${struct}
    </item>`;
    })
    .join("");

  // lastBuildDate 取最新一条的 pubDate(确定性、可缓存);ttl 提示消费端轮询间隔(分钟)。
  const newest = opts.items.reduce((m, it) => (it.pubDate.getTime() > m ? it.pubDate.getTime() : m), 0);
  const lastBuild = newest ? `\n    <lastBuildDate>${new Date(newest).toUTCString()}</lastBuildDate>` : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:x2t="https://x2t.actionow.ai/ns">
  <channel>
    <title>${esc(opts.title)}</title>
    <link>${esc(opts.siteUrl)}</link>
    <atom:link href="${esc(opts.selfUrl)}" rel="self" type="application/rss+xml" />
    <description>${esc(opts.description)}</description>
    <language>zh-CN</language>
    <generator>X2T</generator>
    <ttl>15</ttl>${lastBuild}${items}
  </channel>
</rss>`;
}
