import { prisma } from "./db";
import { sendEmail } from "./email";

// 邮件摘要：给每个关注了博主的用户，发其关注对象过去 24h 的信号摘要。
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

    const lines = posts.map((p) => {
      const name = p.influencer.displayName ?? p.influencer.handle;
      const ai = p.analysis ? `\n  🤖 ${p.analysis.summary}` : "";
      return `• ${name}: ${p.contentText.slice(0, 100)}${ai}`;
    });
    const body = `你关注的博主过去 24h 的信号（${posts.length} 条）：\n\n${lines.join("\n\n")}\n\n— X2T · 非投资建议`;

    await sendEmail(u.email, `X2T 每日摘要 · ${posts.length} 条新信号`, body);
    sent++;
  }

  return { users: users.length, sent };
}
