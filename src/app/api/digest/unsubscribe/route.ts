import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyUnsub } from "@/lib/digest";

export const dynamic = "force-dynamic";

// 邮件一键退订。HMAC token 无需登录。
// GET = 用户点击退订链接;POST = 邮件客户端 List-Unsubscribe-Post One-Click(Gmail/Yahoo 自动调用)。
async function handle(token: string | null) {
  const userId = token ? verifyUnsub(token) : null;
  if (!userId) return NextResponse.json({ error: "invalid token" }, { status: 400 });
  await prisma.user.update({ where: { id: userId }, data: { digestOptIn: false } }).catch(() => {});
  return new NextResponse(
    `<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><body style="font-family:-apple-system,sans-serif;max-width:480px;margin:64px auto;text-align:center;color:#111"><h2>已退订 · Unsubscribed</h2><p style="color:#555">你已退订 X2T 每日摘要。<br>You have unsubscribed from the X2T daily digest.</p><a href="/" style="color:#0a7d37">&larr; X2T</a></body>`,
    { headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

export async function GET(req: Request) {
  return handle(new URL(req.url).searchParams.get("t"));
}
export async function POST(req: Request) {
  return handle(new URL(req.url).searchParams.get("t"));
}
