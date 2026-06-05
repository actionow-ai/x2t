import { NextResponse } from "next/server";
import { consumeMagicLink } from "@/lib/magic-link";
import { SESSION_COOKIE, SESSION_COOKIE_OPTIONS, sessionCookieValue } from "@/lib/auth";

export const dynamic = "force-dynamic";

// 验证 magic-link → 写会话 cookie → 跳首页
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) return new Response("missing token", { status: 400 });

  const userId = await consumeMagicLink(token);
  if (!userId) return new Response("链接无效或已过期", { status: 400 });

  const res = NextResponse.redirect(new URL("/?welcome=1", request.url), 303);
  res.cookies.set(SESSION_COOKIE, sessionCookieValue(userId), SESSION_COOKIE_OPTIONS);
  return res;
}
