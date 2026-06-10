import crypto from "node:crypto";
import { prisma } from "./db";
import { sendEmail } from "./email";
import { detectFlips } from "./stance";
import { SITE_URL } from "./seo";

// 退订 token(HMAC,复用 AUTH_SECRET):邮件一键退订无需登录。
function unsubSecret(): string {
  return process.env.AUTH_SECRET ?? "dev-insecure-secret-change-me";
}
export function signUnsub(userId: string): string {
  const sig = crypto.createHmac("sha256", unsubSecret()).update(`unsub:${userId}`).digest("base64url");
  return `${userId}.${sig}`;
}
export function verifyUnsub(token: string): string | null {
  const i = token.lastIndexOf(".");
  if (i < 0) return null;
  const userId = token.slice(0, i);
  const sig = token.slice(i + 1);
  const expected = crypto.createHmac("sha256", unsubSecret()).update(`unsub:${userId}`).digest("base64url");
  if (sig.length !== expected.length) return null;
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  return userId;
}

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ESC[c] ?? c);

// 邮件摘要：给每个关注了博主并 opt-in 的用户，发其关注对象过去 24h 的信号摘要。
// 头部突出"立场转向"事件 —— 每日回访核心钩子。文+链接(可点回站)+ 一键退订;按 user.locale 中英。
export async function runDigest(): Promise<{ users: number; sent: number; attempted: number; failed: number }> {
  const since = new Date(Date.now() - 24 * 3600 * 1000);
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  // per-user 幂等:只取今天还没成功发过 digest 的 opt-in 用户(中途崩溃重跑不重复轰炸,digest-1)
  const users = await prisma.user.findMany({
    where: { digestOptIn: true, OR: [{ lastDigestAt: null }, { lastDigestAt: { lt: todayStart } }] },
    include: { follows: true },
  });
  let sent = 0;
  let attempted = 0;
  let failed = 0;

  // 跨用户共享 flips 计算(同一帖只算一次),削减 N+1。
  const flipCache = new Map<string, { symbol: string; prevStance: string; newStance: string }[]>();
  const flipsFor = async (postId: string) => {
    if (!flipCache.has(postId)) flipCache.set(postId, await detectFlips(postId));
    return flipCache.get(postId)!;
  };

  for (const u of users) {
    const ids = u.follows.map((f) => f.influencerId);
    if (ids.length === 0) continue;
    // 逐用户独立 try(含 posts 查询/detectFlips):单点 DB 抖动/发送抛错不拖垮整批、不触发整批重发(digest-1/H2)。
    try {
    const posts = await prisma.post.findMany({
      where: { influencerId: { in: ids }, postedAt: { gte: since } },
      include: { influencer: true, analysis: true },
      orderBy: { postedAt: "desc" },
      take: 30,
    });
    if (posts.length === 0) continue;

    const en = u.locale === "en";
    const st = (s: string) => (en ? s : s === "bullish" ? "看多" : s === "bearish" ? "看空" : "中性");

    // 立场转向(头部钩子):仅保留多↔空真反转,滤掉中性摆动(借 daily_stock_analysis 防"狼来了")。
    const flipLines: { name: string; symbol: string; prev: string; next: string }[] = [];
    for (const p of posts) {
      const name = p.influencer.displayName ?? p.influencer.handle;
      for (const f of await flipsFor(p.id)) {
        if (f.prevStance === "neutral" || f.newStance === "neutral") continue;
        flipLines.push({ name, symbol: f.symbol, prev: f.prevStance, next: f.newStance });
      }
    }

    const unsubUrl = `${SITE_URL}/api/digest/unsubscribe?t=${signUnsub(u.id)}`;
    const subject = en
      ? `X2T Daily · ${posts.length} signals${flipLines.length ? `, ${flipLines.length} flips` : ""}`
      : `X2T 每日摘要 · ${posts.length} 条信号${flipLines.length ? `,${flipLines.length} 个转向` : ""}`;

    // 纯文本版(带链接)
    const textLines = posts.map((p) => {
      const name = p.influencer.displayName ?? p.influencer.handle;
      const summary = en ? p.analysis?.summaryEn ?? p.analysis?.summary : p.analysis?.summary;
      const ai = summary ? `\n  AI: ${summary}` : "";
      return `• ${name}: ${p.contentText.slice(0, 100)}${ai}\n  ${SITE_URL}/p/${p.id}`;
    });
    const text = [
      flipLines.length
        ? `${en ? "Stance flips" : "立场转向"} (${flipLines.length}):\n${flipLines.map((f) => `  ${f.name} $${f.symbol}: ${st(f.prev)} -> ${st(f.next)}  ${SITE_URL}/t/${f.symbol}`).join("\n")}\n`
        : "",
      `${en ? `Signals from people you follow (${posts.length}):` : `你关注的博主过去 24h 的信号(${posts.length} 条):`}\n\n${textLines.join("\n\n")}`,
      `\n— X2T · ${en ? "Not financial advice" : "非投资建议"}`,
      `${en ? "Unsubscribe" : "退订"}: ${unsubUrl}`,
    ]
      .filter(Boolean)
      .join("\n");

    // HTML 版(可点击回站 —— 修"纯文本零链接、回站转化为 0")
    const flipHtml = flipLines.length
      ? `<p style="margin:0 0 8px"><strong>${en ? "Stance flips" : "立场转向"} (${flipLines.length})</strong></p><ul style="margin:0 0 16px;padding-left:18px">${flipLines
          .map((f) => `<li><a href="${SITE_URL}/t/${esc(f.symbol)}" style="color:#0a7d37;text-decoration:none">$${esc(f.symbol)}</a> ${esc(f.name)}: ${st(f.prev)} → ${st(f.next)}</li>`)
          .join("")}</ul>`
      : "";
    const postsHtml = posts
      .map((p) => {
        const name = p.influencer.displayName ?? p.influencer.handle;
        const summary = en ? p.analysis?.summaryEn ?? p.analysis?.summary : p.analysis?.summary;
        const ai = summary ? `<div style="color:#555;font-size:13px;margin-top:4px">AI: ${esc(summary.slice(0, 160))}</div>` : "";
        return `<div style="margin:0 0 14px;padding-bottom:12px;border-bottom:1px solid #eee"><a href="${SITE_URL}/p/${p.id}" style="color:#111;font-weight:600;text-decoration:none">${esc(name)}</a><div style="margin-top:2px">${esc(p.contentText.slice(0, 140))}</div>${ai}</div>`;
      })
      .join("");
    const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:600px;margin:0 auto;color:#111">
<h2 style="font-size:18px">X2T ${en ? "Daily Digest" : "每日摘要"}</h2>
${flipHtml}${postsHtml}
<p style="color:#888;font-size:12px;margin-top:20px">— X2T · ${en ? "Not financial advice" : "非投资建议"}<br>
<a href="${unsubUrl}" style="color:#888">${en ? "Unsubscribe from daily digest" : "退订每日摘要"}</a></p></div>`;

      attempted++;
      const r = await sendEmail(u.email, subject, text, { html, listUnsubscribe: unsubUrl });
      if (r.sent) {
        sent++;
        await prisma.user.update({ where: { id: u.id }, data: { lastDigestAt: new Date() } }).catch(() => {}); // 落 per-user 幂等标记
      } else {
        failed++; // 未配邮件(mock 兜底)算未送达,不虚报
      }
    } catch {
      failed++;
    }
  }

  return { users: users.length, sent, attempted, failed };
}
