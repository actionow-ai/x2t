import { prisma } from "../src/lib/db";

// 博主源种子。两类写法：
//   feedPath  —— 经自建 RSSHub（RSSHUB_BASE_URL）解析，覆盖 X/Reddit/StockTwits 等需登录或反爬的源。
//   feedUrl   —— 可直连的真实 RSS（财经新闻 / Substack），无需 RSSHub，开箱即有真数据。
// avatarUrl：默认 DiceBear 占位；真实 feed 含 <image> 时轮询会自动覆盖（见 rss.ts + ingest.ts）。
const ICON = (seed: string) => `https://api.dicebear.com/9.x/shapes/svg?seed=${seed}`;

const seeds = [
  // ===== X 博主（经自建 RSSHub；需在 RSSHub 配 X cookies，见 DEPLOY.md）=====
  {
    handle: "serenity",
    platform: "twitter" as const,
    displayName: "Serenity",
    bio: "美股 / AI 赛道 / 波段。经自建 RSSHub 抓取。Not financial advice.",
    avatarUrl: ICON("serenity"),
    sourceConfig: { connector: "rss", feedPath: "/twitter/user/serenity" },
  },
  {
    handle: "marcotrades",
    platform: "twitter" as const,
    displayName: "Marco Tang",
    bio: "期权 / 财报博弈。经自建 RSSHub 抓取。",
    avatarUrl: ICON("marcotrades"),
    sourceConfig: { connector: "rss", feedPath: "/twitter/user/marcotrades" },
  },

  // ===== 散户情绪（cashtag 丰富，利于图谱；经自建 RSSHub 的 reddit 路由）=====
  {
    handle: "wallstreetbets",
    platform: "reddit" as const,
    displayName: "r/wallstreetbets",
    bio: "Reddit 散户热议，$代码密集。经自建 RSSHub /reddit 路由。",
    avatarUrl: ICON("wallstreetbets"),
    sourceConfig: { connector: "rss", feedPath: "/reddit/subreddit/wallstreetbets/hot" },
  },

  // ===== 可直连真实财经源（无需 RSSHub，开箱即有真数据）=====
  {
    handle: "marketwatch",
    platform: "news" as const,
    displayName: "MarketWatch 头条",
    bio: "可直连真实财经 RSS。验证「抓取→去重→入库→信号流」全链路。",
    avatarUrl: ICON("marketwatch"),
    sourceConfig: { connector: "rss", feedUrl: "https://feeds.marketwatch.com/marketwatch/topstories/" },
  },
  {
    handle: "cnbc-markets",
    platform: "news" as const,
    displayName: "CNBC Markets",
    bio: "可直连真实财经 RSS（CNBC 市场版）。",
    avatarUrl: ICON("cnbc"),
    sourceConfig: { connector: "rss", feedUrl: "https://www.cnbc.com/id/15839135/device/rss/rss.html" },
  },
];

async function main() {
  // 清理历史演示源：marketpulse-demo 与 marketwatch 同源（重复），删除（其帖子级联删除）。
  const removed = await prisma.influencer.deleteMany({ where: { handle: "marketpulse-demo" } });
  if (removed.count) console.log(`[seed] 移除历史源 marketpulse-demo`);

  for (const s of seeds) {
    const inf = await prisma.influencer.upsert({
      where: { platform_handle: { platform: s.platform, handle: s.handle } },
      create: s,
      update: { displayName: s.displayName, bio: s.bio, avatarUrl: s.avatarUrl, sourceConfig: s.sourceConfig },
    });
    console.log(`[seed] ${inf.handle} (${inf.platform})`);
  }
  console.log(`[seed] 完成，共 ${seeds.length} 个博主源`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
