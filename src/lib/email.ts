import nodemailer from "nodemailer";

export function emailConfigured(): boolean {
  return !!process.env.SMTP_HOST;
}

// 发邮件；未配置 SMTP 时打到控制台（dev 可用），返回 sent=false。
export async function sendEmail(to: string, subject: string, text: string): Promise<{ sent: boolean }> {
  if (!emailConfigured()) {
    console.log(`\n──── [email:mock] ────\nto: ${to}\nsubject: ${subject}\n${text}\n─────────────────────\n`);
    return { sent: false };
  }

  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });

  await transport.sendMail({
    from: process.env.SMTP_FROM ?? "X2T <noreply@x2t.local>",
    to,
    subject,
    text,
  });
  return { sent: true };
}
