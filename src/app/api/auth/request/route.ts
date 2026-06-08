import { z } from "zod";
import { createMagicLink } from "@/lib/magic-link";
import { sendEmail, emailConfigured } from "@/lib/email";
import { baseUrl } from "@/lib/base-url";

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

  const { token } = await createMagicLink(parsed.data.email);
  const link = `${baseUrl(request)}/api/auth/verify?token=${token}`;
  await sendEmail(parsed.data.email, "登录 X2T", `点击登录（15 分钟内有效）：\n${link}`);

  // 仅非生产环境回传链接，方便本机直接点击；生产环境绝不外泄（否则任何人可冒充登录）。
  const devLink = !emailConfigured() && process.env.NODE_ENV !== "production" ? link : undefined;
  return Response.json({ ok: true, devLink });
}
