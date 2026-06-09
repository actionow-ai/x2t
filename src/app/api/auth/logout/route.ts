import { NextResponse } from "next/server";
import { SESSION_COOKIE, getCurrentUserId, revokeUserSessions } from "@/lib/auth";
import { baseUrl } from "@/lib/base-url";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  // 服务端撤销:tokenVersion +1,使被登出(或已泄露)的 cookie 立即失效,而非只清客户端
  const uid = await getCurrentUserId();
  if (uid) await revokeUserSessions(uid);
  const res = NextResponse.redirect(`${baseUrl(request)}/`, 303);
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
