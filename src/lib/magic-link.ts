import crypto from "node:crypto";
import { prisma } from "./db";

// magic-link 的 DB 逻辑（不依赖 next/headers，可在 Worker/脚本中复用）。

export async function createMagicLink(email: string): Promise<{ token: string; userId: string }> {
  const user = await prisma.user.upsert({ where: { email }, create: { email }, update: {} });
  const token = crypto.randomBytes(32).toString("hex");
  await prisma.magicLink.create({
    data: { token, email, expiresAt: new Date(Date.now() + 15 * 60 * 1000) },
  });
  return { token, userId: user.id };
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
