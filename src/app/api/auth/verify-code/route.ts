import { z } from "zod";
import { NextResponse } from "next/server";
import { consumeMagicLinkCode } from "@/lib/magic-link";
import { SESSION_COOKIE, SESSION_COOKIE_OPTIONS, sessionCookieValue } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { getLocale } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

const schema = z.object({ email: z.string().email(), code: z.string().regex(/^\d{6}$/) });

// 校验邮箱验证码 → 写会话 cookie。带限流防 6 位码暴力枚举。
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "invalid input" }, { status: 400 });
  const email = parsed.data.email.toLowerCase();
  const code = parsed.data.code;

  const ip = clientIp(request);
  if (!(await rateLimit(`verify:ip:${ip}`, 30, 3_600_000)) || !(await rateLimit(`verify:email:${email}`, 10, 3_600_000))) {
    return Response.json({ error: "too many attempts" }, { status: 429 });
  }

  const userId = await consumeMagicLinkCode(email, code);
  if (!userId) return Response.json({ error: "验证码错误或已过期" }, { status: 400 });

  // 记录界面语言,供服务端推送/邮件按 user.locale 本地化
  await prisma.user.update({ where: { id: userId }, data: { locale: await getLocale() } }).catch(() => {});

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { tokenVersion: true } });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, sessionCookieValue(userId, user?.tokenVersion ?? 0), SESSION_COOKIE_OPTIONS);
  return res;
}
