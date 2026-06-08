import { prisma } from "../src/lib/db";

try {
  process.loadEnvFile();
} catch {
  /* ignore */
}

// 演示用：为多个博主写入带【时间戳】的立场快照，让关系图谱体现时效性。
// agoH = 最新一条的"几小时前"（驱动边的新旧粗细）；prev = 更早的相反立场（制造"转向 ⇄"）。
type Stance = "bullish" | "bearish" | "neutral";
type Call = { sym: string; stance: Stance; agoH: number; prev?: Stance };

const DATA: { handle: string; name: string; calls: Call[] }[] = [
  {
    handle: "serenity",
    name: "Serenity",
    calls: [
      { sym: "NVDA", stance: "bullish", agoH: 0.4 }, // ~24分钟前
      { sym: "AMD", stance: "bullish", agoH: 30 }, // ~1.3天前
      { sym: "TSLA", stance: "bearish", agoH: 5, prev: "bullish" }, // 转向：曾看多→现看空（5小时前）
    ],
  },
  {
    handle: "marcotrades",
    name: "Marco Tang",
    calls: [
      { sym: "TSLA", stance: "bearish", agoH: 50 }, // ~2天前
      { sym: "PLTR", stance: "bullish", agoH: 220 }, // ~9天前，渐旧
    ],
  },
  {
    handle: "macrojane",
    name: "MacroJane",
    calls: [
      { sym: "NVDA", stance: "bullish", agoH: 9 }, // ~9小时前
      { sym: "AAPL", stance: "bullish", agoH: 640 }, // ~27天前，陈旧
      { sym: "COIN", stance: "bearish", agoH: 0.6, prev: "bullish" }, // 转向（~36分钟前）
    ],
  },
  {
    handle: "quantcat",
    name: "QuantCat",
    calls: [
      { sym: "AMD", stance: "bullish", agoH: 0.2 }, // ~12分钟前，最新鲜
      { sym: "SMCI", stance: "bullish", agoH: 0.8 }, // ~48分钟前
      { sym: "NVDA", stance: "bullish", agoH: 110 }, // ~5天前
    ],
  },
];

const H = 3_600_000;

async function makePost(infId: string, pid: string, sym: string, stance: Stance, when: Date, name: string) {
  const post = await prisma.post.upsert({
    where: { influencerId_platformPostId: { influencerId: infId, platformPostId: pid } },
    create: {
      influencerId: infId,
      platformPostId: pid,
      contentText: `$${sym} — ${stance}`,
      postedAt: when,
      analysisStatus: "done",
    },
    update: { postedAt: when, analysisStatus: "done" },
  });
  await prisma.postAnalysis.upsert({
    where: { postId: post.id },
    create: { postId: post.id, summary: `${name} on $${sym}`, keyPoints: [], overallStance: stance },
    update: { overallStance: stance },
  });
  await prisma.postTicker.upsert({
    where: { postId_symbol: { postId: post.id, symbol: sym } },
    create: { postId: post.id, symbol: sym, stance },
    update: { stance },
  });
}

async function main() {
  const now = Date.now();
  const handles = DATA.map((d) => d.handle);
  // 清理早期 demo 帖（单条多票的 graph-demo），避免与新的时间序列重复
  await prisma.post.deleteMany({
    where: { influencer: { handle: { in: handles } }, platformPostId: "graph-demo" },
  });

  for (const d of DATA) {
    const avatarUrl = `https://api.dicebear.com/9.x/shapes/svg?seed=${d.handle}`;
    // macrojane / quantcat 仅用于图谱演示（帖子由本脚本直接写入），不参与真实轮询。
    // serenity / marcotrades 是真实 X 源（由 seed.ts 配 RSSHub feedPath），保持 active。
    const demoOnly = d.handle === "macrojane" || d.handle === "quantcat";
    const inf = await prisma.influencer.upsert({
      where: { platform_handle: { platform: "twitter", handle: d.handle } },
      create: {
        handle: d.handle,
        platform: "twitter",
        displayName: d.name,
        avatarUrl,
        active: !demoOnly,
        sourceConfig: demoOnly
          ? { connector: "manual" }
          : { connector: "rss", feedPath: `/twitter/user/${d.handle}` },
      },
      update: { displayName: d.name, avatarUrl, ...(demoOnly ? { active: false } : {}) },
    });

    for (const c of d.calls) {
      await prisma.security.upsert({ where: { symbol: c.sym }, create: { symbol: c.sym }, update: {} });
      // 最新一条（驱动边的时效性）
      await makePost(inf.id, `gd-${c.sym}-new`, c.sym, c.stance, new Date(now - c.agoH * H), d.name);
      // 更早的相反立场 → 转向 ⇄
      if (c.prev) {
        await makePost(inf.id, `gd-${c.sym}-old`, c.sym, c.prev, new Date(now - (c.agoH + 96) * H), d.name);
      }
    }
    console.log(`[seed-graph] ${d.handle}: ${d.calls.length} calls`);
  }
  console.log("[seed-graph] done");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
