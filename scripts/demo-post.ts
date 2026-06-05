import { prisma } from "../src/lib/db";
import { storePost } from "../src/lib/ingest";

try {
  process.loadEnvFile();
} catch {
  /* ignore */
}

// 插一条带 cashtag 的 demo 帖，用于验证 Agent 的 ticker 抽取 + 外部数据 + 分析展示。
async function main() {
  const inf = await prisma.influencer.findFirst({ where: { handle: "marketpulse-demo" } });
  if (!inf) throw new Error("缺少种子博主 marketpulse-demo（先 pnpm db:seed）");
  const p = await storePost(inf.id, {
    platformPostId: "demo-cashtags",
    contentText:
      "Loading up on $NVDA and $AMD — very bullish on the AI capex cycle. $INTC looks weak into earnings.",
    postedAt: new Date(),
  });
  console.log(`POSTID=${p.id}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
