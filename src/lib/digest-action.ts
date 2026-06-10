"use server";

import { prisma } from "./db";
import { requireUserId } from "./auth";

// 切换邮件每日摘要订阅(opt-in)。仅登录用户。
export async function setDigestOptIn(optIn: boolean): Promise<{ ok: boolean }> {
  const uid = await requireUserId();
  if (!uid) return { ok: false };
  await prisma.user.update({ where: { id: uid }, data: { digestOptIn: optIn } });
  return { ok: true };
}
