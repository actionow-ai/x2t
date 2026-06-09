import { prisma } from "./db";
import { sendEmail } from "./email";
import { detectFlips } from "./stance";

// 邮件摘要：给每个关注了博主的用户，发其关注对象过去 24h 的信号摘要。
// 头部突出"立场转向"事件(谁对某标的翻多/翻空)—— 每日回访的核心钩子。
export async function runDigest(): Promise<{ users: number; sent: number }> {
  const since = new Date(Date.now() - 24 * 3600 * 1000);
  const users = await prisma.user.findMany({ include: { follows: true } });
  let sent = 0;

  for (const u of users) {
    const ids = u.follows.map((f) => f.influencerId);
    if (ids.length === 0) continue;

    const posts = await prisma.post.findMany({
      where: { influencerId: { in: ids }, postedAt: { gte: since } },
      include: { influencer: true, analysis: true },
      orderBy: { postedAt: "desc" },
      take: 30,
    });
    if (posts.length === 0) continue;

    // 立场转向(头部钩子):该用户关注的博主过去 24h 有谁对某标的改变了立场
    // 防抖(借 daily_stock_analysis):只突出【方向反转】(看多↔看空),滤掉中性↔X 的低含金量摆动,避免狼来了。
    const flipLines: string[] = [];
    for (const p of posts) {
      const name = p.influencer.displayName ?? p.influencer.handle;
      for (const f of await detectFlips(p.id)) {
        if (f.prevStance === "neutral" || f.newStance === "neutral") continue; // 仅保留多↔空的真反转
        flipLines.push(`[转向] ${name} 对 $${f.symbol}：${f.prevStance} → ${f.newStance}`);
      }
    }

    const lines = posts.map((p) => {
      const name = p.influencer.displayName ?? p.influencer.handle;
      const ai = p.analysis ? `\n  AI: ${p.analysis.summary}` : "";
      return `• ${name}: ${p.contentText.slice(0, 100)}${ai}`;
    });

    const body = [
      flipLines.length ? `【立场转向 ${flipLines.length}】\n${flipLines.join("\n")}\n` : "",
      `你关注的博主过去 24h 的信号（${posts.length} 条）：\n\n${lines.join("\n\n")}`,
      "\n— X2T · 非投资建议",
    ]
      .filter(Boolean)
      .join("\n");

    const subject = flipLines.length
      ? `X2T 每日摘要 · ${posts.length} 条信号，${flipLines.length} 个转向`
      : `X2T 每日摘要 · ${posts.length} 条新信号`;
    await sendEmail(u.email, subject, body);
    sent++;
  }

  return { users: users.length, sent };
}
