import { NextResponse } from "next/server";
import { consumeMagicLink } from "@/lib/magic-link";
import { SESSION_COOKIE, SESSION_COOKIE_OPTIONS, sessionCookieValue } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { baseUrl } from "@/lib/base-url";
import { getLocale } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

// 验证 magic-link → 写会话 cookie(带当前 tokenVersion)→ 跳首页
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) return new Response("missing token", { status: 400 });

  const userId = await consumeMagicLink(token);
  if (!userId) return new Response("链接无效或已过期", { status: 400 });

  // 记录界面语言,供服务端推送/邮件按 user.locale 本地化
  await prisma.user.update({ where: { id: userId }, data: { locale: await getLocale() } }).catch(() => {});

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { tokenVersion: true } });

  const res = NextResponse.redirect(`${baseUrl(request)}/`, 303);
  res.cookies.set(SESSION_COOKIE, sessionCookieValue(userId, user?.tokenVersion ?? 0), SESSION_COOKIE_OPTIONS);
  return res;
}
