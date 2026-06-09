import { z } from "zod";
import { createMagicLink } from "@/lib/magic-link";
import { sendEmail, emailConfigured } from "@/lib/email";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

const schema = z.object({ email: z.string().email() });

// 请求 magic-link 登录邮件
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "invalid email" }, { status: 400 });
  const email = parsed.data.email.toLowerCase();

  // 限流(IP 20/h + 邮箱 5/h):防邮件轰炸放大与用户表灌水;超限静默成功(顺带防账号枚举)
  const ip = clientIp(request);
  if (!(await rateLimit(`login:ip:${ip}`, 20, 3_600_000)) || !(await rateLimit(`login:email:${email}`, 5, 3_600_000))) {
    return Response.json({ ok: true });
  }

  const { code } = await createMagicLink(email);
  try {
    await sendEmail(email, "X2T 登录验证码", `你的 X2T 登录验证码是：${code}\n15 分钟内有效。如非本人操作请忽略。`);
  } catch (e) {
    // 不把上游错误体外泄,仅服务端记录
    console.error("[auth] 发信失败:", e instanceof Error ? e.message : e);
  }

  // 仅非生产环境回传验证码,方便本机直接登录;生产绝不外泄。
  const devCode = !emailConfigured() && process.env.NODE_ENV !== "production" ? code : undefined;
  return Response.json({ ok: true, devCode });
}
