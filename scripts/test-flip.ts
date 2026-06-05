import { prisma } from "../src/lib/db";
import { storePost } from "../src/lib/ingest";
import { analyzePost } from "../src/lib/agent";
import { detectFlips } from "../src/lib/stance";

try {
  process.loadEnvFile();
} catch {
  /* ignore */
}

// 验证转向检测：同一博主对 $TSLA 先看多后看空 → detectFlips 应识别 bullish→bearish。
async function main() {
  const inf = await prisma.influencer.upsert({
    where: { platform_handle: { platform: "manual", handle: "fliptest" } },
    create: { handle: "fliptest", platform: "manual", displayName: "Flip Test", sourceConfig: { connector: "manual" } },
    update: {},
  });

  const p1 = await storePost(inf.id, {
    platformPostId: "flip-1",
    contentText: "$TSLA buy, long, very bullish breakout",
    postedAt: new Date(Date.now() - 3_600_000),
  });
  const p2 = await storePost(inf.id, {
    platformPostId: "flip-2",
    contentText: "$TSLA short, bearish, dump it, looks weak",
    postedAt: new Date(),
  });

  await analyzePost(p1.id);
  await analyzePost(p2.id);

  const t1 = await prisma.postTicker.findFirst({ where: { postId: p1.id, symbol: "TSLA" } });
  const t2 = await prisma.postTicker.findFirst({ where: { postId: p2.id, symbol: "TSLA" } });
  const flips = await detectFlips(p2.id);
  console.log(`p1 TSLA=${t1?.stance}  p2 TSLA=${t2?.stance}`);
  console.log("flips on p2:", JSON.stringify(flips));

  await prisma.influencer.delete({ where: { id: inf.id } }).catch(() => {}); // cascade 清理

  const ok =
    t1?.stance === "bullish" &&
    t2?.stance === "bearish" &&
    flips.some((f) => f.symbol === "TSLA" && f.prevStance === "bullish" && f.newStance === "bearish");
  console.log(ok ? "✅ 转向检测正确 (bullish→bearish)" : "❌ 不符合预期");
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
