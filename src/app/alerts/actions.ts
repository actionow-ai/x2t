"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";
import { isValidSymbol } from "@/lib/symbol";

export async function createAlert(formData: FormData) {
  const uid = await getCurrentUserId();
  if (!uid) return;

  const rawSym = String(formData.get("symbol") ?? "").trim().replace(/^\$/, "").toUpperCase();
  const symbol = rawSym && isValidSymbol(rawSym) ? rawSym : null;
  const minBull = Math.max(0, Math.min(50, Number(formData.get("minBull")) || 0));
  const minBear = Math.max(0, Math.min(50, Number(formData.get("minBear")) || 0));
  const onFlip = formData.get("onFlip") === "on";
  const combine = formData.get("combine") === "and" ? "and" : "or";

  // 至少一个条件
  if (minBull === 0 && minBear === 0 && !onFlip) return;
  // 上限:每用户最多 20 条规则
  const count = await prisma.alertRule.count({ where: { userId: uid } });
  if (count >= 20) return;

  await prisma.alertRule.create({ data: { userId: uid, symbol, minBull, minBear, onFlip, combine } });
  revalidatePath("/alerts");
}

export async function deleteAlert(formData: FormData) {
  const uid = await getCurrentUserId();
  if (!uid) return;
  const id = String(formData.get("id") ?? "");
  await prisma.alertRule.deleteMany({ where: { id, userId: uid } }); // deleteMany 带 userId 守卫:只能删自己的
  revalidatePath("/alerts");
}
