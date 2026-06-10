import nodemailer from "nodemailer";

// 发件人地址（CF / SMTP 共用）。注意：必须是【已验证域名】的地址（如 noreply@actionow.ai）。
function fromAddress(): string {
  return process.env.EMAIL_FROM ?? process.env.SMTP_FROM ?? "X2T <noreply@x2t.local>";
}

function cfConfigured(): boolean {
  return !!(process.env.CF_EMAIL_ACCOUNT_ID && process.env.CF_EMAIL_API_TOKEN);
}

function smtpConfigured(): boolean {
  return !!process.env.SMTP_HOST;
}

export function emailConfigured(): boolean {
  return cfConfigured() || smtpConfigured();
}

export type EmailOpts = { html?: string; listUnsubscribe?: string };

// 发邮件；三选一：Cloudflare Email Service(REST) > SMTP(nodemailer) > 控制台兜底(返回 sent=false)。
// opts.html 提供富文本版本(digest 可点击回站);opts.listUnsubscribe 注入 List-Unsubscribe 头
// (Gmail/Yahoo 2024 发件人要求 + CAN-SPAM 一键退订合规)。
export async function sendEmail(to: string, subject: string, text: string, opts?: EmailOpts): Promise<{ sent: boolean }> {
  const headers = opts?.listUnsubscribe
    ? { "List-Unsubscribe": `<${opts.listUnsubscribe}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" }
    : undefined;

  // 1) Cloudflare Email Service（REST API）
  if (cfConfigured()) {
    const acct = process.env.CF_EMAIL_ACCOUNT_ID!;
    const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${acct}/email/sending/send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.CF_EMAIL_API_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: fromAddress(), to, subject, text, ...(opts?.html ? { html: opts.html } : {}), ...(headers ? { headers } : {}) }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Cloudflare Email 发送失败 ${res.status}: ${body.slice(0, 300)}`);
    }
    return { sent: true };
  }

  // 2) SMTP（nodemailer）
  if (smtpConfigured()) {
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
    await transport.sendMail({ from: fromAddress(), to, subject, text, html: opts?.html, headers });
    return { sent: true };
  }

  // 3) 控制台兜底（dev / 未配邮件时）
  console.log(`\n──── [email:mock] ────\nto: ${to}\nsubject: ${subject}\n${text}\n─────────────────────\n`);
  return { sent: false };
}
