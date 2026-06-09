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

  // ===== 美股有观点的交易员/分析师批次（逐标的表态,经自建 RSSHub）=====
  { handle: "allstarcharts", platform: "twitter" as const, displayName: "JC Parets", bio: "技术分析 / 明确多空 / 逐个标的画图。", avatarUrl: ICON("allstarcharts"), sourceConfig: { connector: "rss", feedPath: "/twitter/user/allstarcharts" } },
  { handle: "OptionsHawk", platform: "twitter" as const, displayName: "OptionsHawk", bio: "期权异动流 / 标的具体的多空。", avatarUrl: ICON("OptionsHawk"), sourceConfig: { connector: "rss", feedPath: "/twitter/user/OptionsHawk" } },
  { handle: "GerberKawasaki", platform: "twitter" as const, displayName: "Ross Gerber", bio: "TSLA / 科技股,立场鲜明。", avatarUrl: ICON("GerberKawasaki"), sourceConfig: { connector: "rss", feedPath: "/twitter/user/GerberKawasaki" } },
  { handle: "DougKass", platform: "twitter" as const, displayName: "Doug Kass", bio: "对冲基金 / 明确做多·做空个股。", avatarUrl: ICON("DougKass"), sourceConfig: { connector: "rss", feedPath: "/twitter/user/DougKass" } },
  { handle: "markminervini", platform: "twitter" as const, displayName: "Mark Minervini", bio: "动量成长股 / SEPA 选股。", avatarUrl: ICON("markminervini"), sourceConfig: { connector: "rss", feedPath: "/twitter/user/markminervini" } },
  { handle: "hmeisler", platform: "twitter" as const, displayName: "Helene Meisler", bio: "技术派 / 超买超卖 / 个股位。", avatarUrl: ICON("hmeisler"), sourceConfig: { connector: "rss", feedPath: "/twitter/user/hmeisler" } },
  { handle: "KobeissiLetter", platform: "twitter" as const, displayName: "The Kobeissi Letter", bio: "宏观 + 市场高频实时点评,$代码多。", avatarUrl: ICON("KobeissiLetter"), sourceConfig: { connector: "rss", feedPath: "/twitter/user/KobeissiLetter" } },
  { handle: "charliebilello", platform: "twitter" as const, displayName: "Charlie Bilello", bio: "数据驱动的市场与个股观点。", avatarUrl: ICON("charliebilello"), sourceConfig: { connector: "rss", feedPath: "/twitter/user/charliebilello" } },
  { handle: "LizAnnSonders", platform: "twitter" as const, displayName: "Liz Ann Sonders", bio: "嘉信首席策略 / 市场与板块。", avatarUrl: ICON("LizAnnSonders"), sourceConfig: { connector: "rss", feedPath: "/twitter/user/LizAnnSonders" } },
  { handle: "biancoresearch", platform: "twitter" as const, displayName: "Jim Bianco", bio: "宏观 / 利率 / 市场。", avatarUrl: ICON("biancoresearch"), sourceConfig: { connector: "rss", feedPath: "/twitter/user/biancoresearch" } },
  { handle: "QuiverQuant", platform: "twitter" as const, displayName: "Quiver Quantitative", bio: "国会 / 内部人交易,标的明确。", avatarUrl: ICON("QuiverQuant"), sourceConfig: { connector: "rss", feedPath: "/twitter/user/QuiverQuant" } },
  { handle: "PeterLBrandt", platform: "twitter" as const, displayName: "Peter Brandt", bio: "经典图表交易 / 股指·商品。", avatarUrl: ICON("PeterLBrandt"), sourceConfig: { connector: "rss", feedPath: "/twitter/user/PeterLBrandt" } },

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
      // 不更新 avatarUrl:已运行的轮询会用真实 feed 图覆盖占位图,re-seed 不能把它打回占位
      update: { displayName: s.displayName, bio: s.bio, sourceConfig: s.sourceConfig },
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
