import { describe, it, expect } from "vitest";
import { postToItem, buildRss, type PostForRss } from "./rss";

const post: PostForRss = {
  id: "p1",
  contentText: "Hello $NVDA\nsecond line",
  url: null,
  postedAt: new Date("2026-01-01T00:00:00Z"),
  influencer: { handle: "serenity", displayName: "Serenity" },
  analysis: { summary: "bullish on nvda", overallStance: "bullish", confidence: 0.7 },
  tickers: [{ symbol: "NVDA", stance: "bullish" }],
};

describe("rss", () => {
  it("postToItem 带结构化 stance/tickers + 站内链接兜底", () => {
    const item = postToItem(post, "https://x2t.actionow.ai");
    expect(item.stance).toBe("bullish");
    expect(item.tickers).toEqual([{ symbol: "NVDA", stance: "bullish" }]);
    expect(item.link).toBe("https://x2t.actionow.ai/p/p1");
  });
  it("buildRss 输出含 x2t 结构化字段与命名空间", () => {
    const xml = buildRss({ title: "t", description: "d", selfUrl: "s", siteUrl: "u", items: [postToItem(post, "u")] });
    expect(xml).toContain("xmlns:x2t");
    expect(xml).toContain("<x2t:stance>bullish</x2t:stance>");
    expect(xml).toContain('<x2t:ticker symbol="NVDA" stance="bullish" />');
  });
  it("XML 特殊字符被转义", () => {
    const xml = buildRss({ title: "<x>", description: "a & b", selfUrl: "s", siteUrl: "u", items: [] });
    expect(xml).toContain("&lt;x&gt;");
    expect(xml).toContain("a &amp; b");
    expect(xml).not.toContain("<title><x></title>");
  });
});
