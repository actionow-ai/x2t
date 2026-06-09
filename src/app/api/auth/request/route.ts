import { z } from "zod";
import { createMagicLink } from "@/lib/magic-link";
import { sendEmail, emailConfigured } from "@/lib/email";
import { baseUrl } from "@/lib/base-url";
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

  const { token } = await createMagicLink(email);
  const link = `${baseUrl(request)}/api/auth/verify?token=${token}`;
  try {
    await sendEmail(email, "登录 X2T", `点击登录（15 分钟内有效）：\n${link}`);
  } catch (e) {
    // 不把上游错误体外泄,仅服务端记录
    console.error("[auth] 发信失败:", e instanceof Error ? e.message : e);
  }

  // 仅非生产环境回传链接,方便本机直接点击;生产绝不外泄(否则任何人可冒充登录)。
  const devLink = !emailConfigured() && process.env.NODE_ENV !== "production" ? link : undefined;
  return Response.json({ ok: true, devLink });
}
