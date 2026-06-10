import crypto from "node:crypto";
import { prisma } from "./db";

// magic-link 的 DB 逻辑（不依赖 next/headers，可在 Worker/脚本中复用）。

export async function createMagicLink(email: string): Promise<{ token: string; code: string; userId: string }> {
  const user = await prisma.user.upsert({ where: { email }, create: { email }, update: {} });
  // 作废该邮箱旧的未用码:同邮箱同一时刻只保留一个有效码,收紧 6 位码暴力枚举面(安全 MEDIUM-3)
  await prisma.magicLink.updateMany({ where: { email, usedAt: null }, data: { usedAt: new Date() } });
  const token = crypto.randomBytes(32).toString("hex");
  // 6 位邮箱验证码(OTP):用 crypto 取 0-999999,补零
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  await prisma.magicLink.create({
    data: { token, code, email, expiresAt: new Date(Date.now() + 15 * 60 * 1000) },
  });
  return { token, code, userId: user.id };
}

// 校验并消费邮箱验证码(单次使用),返回 userId。原子 CAS,防并发/重放。
export async function consumeMagicLinkCode(email: string, code: string): Promise<string | null> {
  if (!/^\d{6}$/.test(code)) return null;
  // 取该邮箱最新一条匹配 code 的未用未过期记录(用其 token 做原子消费)
  const link = await prisma.magicLink.findFirst({
    where: { email, code, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: { token: true },
  });
  if (!link) return null;
  const res = await prisma.magicLink.updateMany({
    where: { token: link.token, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });
  if (res.count !== 1) return null;
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  return user?.id ?? null;
}

// 校验并消费（单次使用），返回 userId
export async function consumeMagicLink(token: string): Promise<string | null> {
  // 原子消费:updateMany 带 usedAt:null + 未过期守卫,用返回 count 判定本次是否抢到(单语句 CAS,防并发双消费 TOCTOU)
  const res = await prisma.magicLink.updateMany({
    where: { token, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });
  if (res.count !== 1) return null;
  const link = await prisma.magicLink.findUnique({ where: { token }, select: { email: true } });
  if (!link) return null;
  const user = await prisma.user.findUnique({ where: { email: link.email } });
  return user?.id ?? null;
}
