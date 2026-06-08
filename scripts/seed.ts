import { prisma } from "../src/lib/db";

// 博主源种子。两类写法：
//   feedPath  —— 经自建 RSSHub（RSSHUB_BASE_URL）解析，覆盖 X/Reddit/StockTwits 等需登录或反爬的源。
//   feedUrl   —— 可直连的真实 RSS（财经新闻 / Substack），无需 RSSHub，开箱即有真数据。
// avatarUrl：默认 DiceBear 占位；真实 feed 含 <image> 时轮询会自动覆盖（见 rss.ts + ingest.ts）。
const ICON = (seed: string) => `https://api.dicebear.com/9.x/shapes/svg?seed=${seed}`;

const seeds = [
  // ===== X 博主（经自建 RSSHub；需在 RSSHub 配 X cookies，见 DEPLOY.md）=====
  {
    handle: "aleabitoreddit",
    platform: "twitter" as const,
    displayName: "Serenity",
    bio: "美股 / AI 赛道 / 波段。经自建 RSSHub 抓取(x.com/aleabitoreddit)。Not financial advice.",
    avatarUrl: ICON("serenity"),
    sourceConfig: { connector: "rss", feedPath: "/twitter/user/aleabitoreddit" },
  },
  {
    handle: "marcotrades",
    platform: "twitter" as const,
    displayName: "Marco Tang",
    bio: "期权 / 财报博弈。经自建 RSSHub 抓取。",
    avatarUrl: ICON("marcotrades"),
    sourceConfig: { connector: "rss", feedPath: "/twitter/user/marcotrades" },
  },

  // ===== 同类热门博主（标的明确 / 喊单·快讯型；经自建 RSSHub）=====
  { handle: "unusual_whales", platform: "twitter" as const, displayName: "Unusual Whales", bio: "期权异动 / 资金流，$代码极密。", avatarUrl: ICON("unusual_whales"), sourceConfig: { connector: "rss", feedPath: "/twitter/user/unusual_whales" } },
  { handle: "AdamMancini", platform: "twitter" as const, displayName: "Adam Mancini", bio: "每日 SPX / ES 期指关键点位。", avatarUrl: ICON("AdamMancini"), sourceConfig: { connector: "rss", feedPath: "/twitter/user/AdamMancini" } },
  { handle: "StockMKTNewz", platform: "twitter" as const, displayName: "Stock Market News", bio: "个股 / 财报快讯，$代码多。", avatarUrl: ICON("StockMKTNewz"), sourceConfig: { connector: "rss", feedPath: "/twitter/user/StockMKTNewz" } },
  { handle: "WOLF_Financial", platform: "twitter" as const, displayName: "Wolf Financial", bio: "市场评论 / 主题。", avatarUrl: ICON("WOLF_Financial"), sourceConfig: { connector: "rss", feedPath: "/twitter/user/WOLF_Financial" } },
  { handle: "DeItaone", platform: "twitter" as const, displayName: "Walter Bloomberg", bio: "宏观 / 市场头条快讯。", avatarUrl: ICON("DeItaone"), sourceConfig: { connector: "rss", feedPath: "/twitter/user/DeItaone" } },
  { handle: "zerohedge", platform: "twitter" as const, displayName: "ZeroHedge", bio: "宏观 / 风险叙事（偏空）。", avatarUrl: ICON("zerohedge"), sourceConfig: { connector: "rss", feedPath: "/twitter/user/zerohedge" } },
  { handle: "timothysykes", platform: "twitter" as const, displayName: "Timothy Sykes", bio: "短线 / 小盘教学与喊单。", avatarUrl: ICON("timothysykes"), sourceConfig: { connector: "rss", feedPath: "/twitter/user/timothysykes" } },
  { handle: "Barchart", platform: "twitter" as const, displayName: "Barchart", bio: "市场数据 / 技术位 / 异动。", avatarUrl: ICON("Barchart"), sourceConfig: { connector: "rss", feedPath: "/twitter/user/Barchart" } },

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
  // 清理历史源：marketpulse-demo（与 marketwatch 重复）+ wallstreetbets（reddit 路由暂不可用）。
  const removed = await prisma.influencer.deleteMany({ where: { handle: { in: ["marketpulse-demo", "wallstreetbets"] } } });
  if (removed.count) console.log(`[seed] 移除历史源 ${removed.count} 个`);

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
