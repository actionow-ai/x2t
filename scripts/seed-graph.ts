import { prisma } from "../src/lib/db";

try {
  process.loadEnvFile();
} catch {
  /* ignore */
}

// 演示用：为多个博主直接写入 post_tickers，让关系图谱有丰富内容（含绿/红立场与共识）。
type Stance = "bullish" | "bearish" | "neutral";
const DATA: { handle: string; name: string; tickers: { sym: string; stance: Stance }[] }[] = [
  { handle: "serenity", name: "Serenity", tickers: [{ sym: "NVDA", stance: "bullish" }, { sym: "AMD", stance: "bullish" }, { sym: "TSLA", stance: "bearish" }] },
  { handle: "marcotrades", name: "Marco Tang", tickers: [{ sym: "TSLA", stance: "bearish" }, { sym: "PLTR", stance: "bullish" }] },
  { handle: "macrojane", name: "MacroJane", tickers: [{ sym: "NVDA", stance: "bullish" }, { sym: "AAPL", stance: "bullish" }, { sym: "COIN", stance: "bearish" }] },
  { handle: "quantcat", name: "QuantCat", tickers: [{ sym: "AMD", stance: "bullish" }, { sym: "SMCI", stance: "bullish" }, { sym: "NVDA", stance: "bullish" }] },
];

async function main() {
  for (const d of DATA) {
    const avatarUrl = `https://api.dicebear.com/9.x/shapes/svg?seed=${d.handle}`;
    const inf = await prisma.influencer.upsert({
      where: { platform_handle: { platform: "twitter", handle: d.handle } },
      create: { handle: d.handle, platform: "twitter", displayName: d.name, avatarUrl, sourceConfig: { connector: "rss", feedUrl: `https://rsshub.app/twitter/user/${d.handle}` } },
      update: { displayName: d.name, avatarUrl },
    });

    const post = await prisma.post.upsert({
      where: { influencerId_platformPostId: { influencerId: inf.id, platformPostId: "graph-demo" } },
      create: {
        influencerId: inf.id,
        platformPostId: "graph-demo",
        contentText: `Demo calls: ${d.tickers.map((t) => `$${t.sym}`).join(" ")}`,
        postedAt: new Date(),
        analysisStatus: "done",
      },
      update: { analysisStatus: "done" },
    });

    await prisma.postAnalysis.upsert({
      where: { postId: post.id },
      create: { postId: post.id, summary: `${d.name} 的示例立场`, keyPoints: [], overallStance: "neutral" },
      update: {},
    });

    for (const t of d.tickers) {
      await prisma.security.upsert({ where: { symbol: t.sym }, create: { symbol: t.sym }, update: {} });
      await prisma.postTicker.upsert({
        where: { postId_symbol: { postId: post.id, symbol: t.sym } },
        create: { postId: post.id, symbol: t.sym, stance: t.stance },
        update: { stance: t.stance },
      });
    }
    console.log(`[seed-graph] ${d.handle}: ${d.tickers.length} tickers`);
  }
  console.log("[seed-graph] done");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
