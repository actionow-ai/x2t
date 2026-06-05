import { prisma } from "../src/lib/db";

// 示例博主源。实际部署请替换成真实博主的 RSSHub/Nitter 源。
// 注意：rsshub.app 公共实例可能被限流/封锁——自托管一个 RSSHub 更稳。
const seeds = [
  {
    handle: "serenity",
    platform: "twitter" as const,
    displayName: "Serenity",
    bio: "美股 / AI 赛道 / 波段。示例博主。Not financial advice.",
    sourceConfig: { connector: "rss", feedUrl: "https://rsshub.app/twitter/user/serenity" },
  },
  {
    handle: "marcotrades",
    platform: "twitter" as const,
    displayName: "Marco Tang",
    bio: "期权 / 财报博弈。示例博主。",
    sourceConfig: { connector: "rss", feedUrl: "https://rsshub.app/twitter/user/marcotrades" },
  },
  {
    // 用一个稳定的公开财经 RSS 演示抓取管道，确保 poll:once 能拉到真实条目。
    handle: "marketpulse-demo",
    platform: "twitter" as const,
    displayName: "MarketPulse (demo feed)",
    bio: "演示用：稳定财经 RSS。验证「抓取→去重→入库→feed」管道。",
    sourceConfig: { connector: "rss", feedUrl: "https://feeds.marketwatch.com/marketwatch/topstories/" },
  },
];

async function main() {
  for (const s of seeds) {
    const inf = await prisma.influencer.upsert({
      where: { platform_handle: { platform: s.platform, handle: s.handle } },
      create: s,
      update: { displayName: s.displayName, bio: s.bio, sourceConfig: s.sourceConfig },
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
