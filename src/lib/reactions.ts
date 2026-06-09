import { cookies } from "next/headers";
import crypto from "node:crypto";
import { prisma } from "./db";
import { getCurrentUserId } from "./auth";

const ANON_COOKIE = "x2t_voter";

// voter 标识:登录用 u:<userId>,匿名用 a:<cookie随机id>。create=true 时(仅在 server action 内)缺失则种 cookie。
export async function getVoterKey(create: boolean): Promise<string | null> {
  const uid = await getCurrentUserId();
  if (uid) return `u:${uid}`;
  const jar = await cookies();
  let v = jar.get(ANON_COOKIE)?.value;
  if (!v && create) {
    v = crypto.randomBytes(12).toString("hex");
    jar.set(ANON_COOKIE, v, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  }
  return v ? `a:${v}` : null;
}

// 批量取某 voter 对一批帖的投票(供 feed 初始化高亮)。只读,可在 server component 调用。
export async function getMyVotes(postIds: string[]): Promise<Record<string, number>> {
  if (!postIds.length) return {};
  const voterKey = await getVoterKey(false);
  if (!voterKey) return {};
  const rows = await prisma.postReaction.findMany({
    where: { voterKey, postId: { in: postIds } },
    select: { postId: true, value: true },
  });
  return Object.fromEntries(rows.map((r) => [r.postId, r.value]));
}
