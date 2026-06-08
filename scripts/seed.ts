import { prisma } from "../src/lib/db";

// 示例博主源。实际部署请替换成真实博主的 RSSHub/Nitter 源。
// avatarUrl：演示用（DiceBear 生成的稳定头像）。真实 RSS（RSSHub/Substack）含 <image> 时，
// 轮询会自动用 feed 的头像覆盖（见 src/lib/connectors/rss.ts + ingest.ts）。
const seeds = [
  {
    handle: "serenity",
    platform: "twitter" as const,
    displayName: "Serenity",
    bio: "美股 / AI 赛道 / 波段。示例博主。Not financial advice.",
    avatarUrl: "https://api.dicebear.com/9.x/shapes/svg?seed=serenity",
    sourceConfig: { connector: "rss", feedUrl: "https://rsshub.app/twitter/user/serenity" },
  },
  {
    handle: "marcotrades",
    platform: "twitter" as const,
    displayName: "Marco Tang",
    bio: "期权 / 财报博弈。示例博主。",
    avatarUrl: "https://api.dicebear.com/9.x/shapes/svg?seed=marcotrades",
    sourceConfig: { connector: "rss", feedUrl: "https://rsshub.app/twitter/user/marcotrades" },
  },
  {
    handle: "marketpulse-demo",
    platform: "twitter" as const,
    displayName: "MarketPulse (demo feed)",
    bio: "演示用：稳定财经 RSS。验证「抓取→去重→入库→feed」管道。",
    avatarUrl: "https://api.dicebear.com/9.x/shapes/svg?seed=marketpulse",
    sourceConfig: { connector: "rss", feedUrl: "https://feeds.marketwatch.com/marketwatch/topstories/" },
  },
];

async function main() {
  for (const s of seeds) {
    const inf = await prisma.influencer.upsert({
      where: { platform_handle: { platform: s.platform, handle: s.handle } },
      create: s,
      update: { displayName: s.displayName, bio: s.bio, avatarUrl: s.avatarUrl, sourceConfig: s.sourceConfig },
    });
    console.log(`[seed] ${inf.handle} (${inf.id})`);
  }
  console.log(`[seed] 完成，共 ${seeds.length} 个博主源`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
