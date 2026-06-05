import { z } from "zod";
import { createMagicLink } from "@/lib/magic-link";
import { sendEmail, emailConfigured } from "@/lib/email";

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

  const origin = new URL(request.url).origin;
  const { token } = await createMagicLink(parsed.data.email);
  const link = `${origin}/api/auth/verify?token=${token}`;
  await sendEmail(parsed.data.email, "登录 X2T", `点击登录（15 分钟内有效）：\n${link}`);

  // dev（未配 SMTP）回传链接，方便直接点击
  return Response.json({ ok: true, devLink: emailConfigured() ? undefined : link });
}
