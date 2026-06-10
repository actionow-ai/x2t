"use server";

import { headers } from "next/headers";
import { prisma } from "./db";
import { getVoterKey } from "./reactions";
import { rateLimit, clientIpFrom } from "./ratelimit";

export type ReactResult = { likes: number; dislikes: number; myVote: number };

// 读当前真实计数(超限/并发冲突时回退展示用)。
async function snapshot(postId: string, voterKey: string): Promise<ReactResult> {
  const [post, mine] = await Promise.all([
    prisma.post.findUnique({ where: { id: postId }, select: { likeCount: true, dislikeCount: true } }),
    prisma.postReaction.findUnique({ where: { postId_voterKey: { postId, voterKey } }, select: { value: true } }),
  ]);
  return { likes: Math.max(0, post?.likeCount ?? 0), dislikes: Math.max(0, post?.dislikeCount ?? 0), myVote: mine?.value ?? 0 };
}

// 赞/踩(value 1/-1):同票再点=取消;反向点=切换。返回新计数 + 我的当前票。计数去规范化到 Post。
export async function reactToPost(postId: string, value: 1 | -1): Promise<ReactResult> {
  const voterKey = await getVoterKey(true);
  if (!voterKey) return { likes: 0, dislikes: 0, myVote: 0 };

  // 限流:IP + voter 双维度,挡住"匿名清 cookie 无限新建 voterKey 刷量膨胀 likeCount"(安全 HIGH-1)。
  const ip = clientIpFrom(await headers());
  if (!(await rateLimit(`react:ip:${ip}`, 60, 60_000)) || !(await rateLimit(`react:voter:${voterKey}`, 30, 60_000))) {
    return snapshot(postId, voterKey);
  }

  try {
    // 事务:reaction 写入与计数 increment 原子化,避免并发双击导致 likeCount 漂移(架构 P0-2)。
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.postReaction.findUnique({ where: { postId_voterKey: { postId, voterKey } } });
      let likeDelta = 0;
      let dislikeDelta = 0;
      let myVote: number = value;
      if (!existing) {
        await tx.postReaction.create({ data: { postId, voterKey, value } });
        if (value === 1) likeDelta = 1;
        else dislikeDelta = 1;
      } else if (existing.value === value) {
        await tx.postReaction.delete({ where: { postId_voterKey: { postId, voterKey } } }); // 再点取消
        if (value === 1) likeDelta = -1;
        else dislikeDelta = -1;
        myVote = 0;
      } else {
        await tx.postReaction.update({ where: { postId_voterKey: { postId, voterKey } }, data: { value } }); // 切换
        if (value === 1) {
          likeDelta = 1;
          dislikeDelta = -1;
        } else {
          likeDelta = -1;
          dislikeDelta = 1;
        }
      }
      const post = await tx.post.update({
        where: { id: postId },
        data: { likeCount: { increment: likeDelta }, dislikeCount: { increment: dislikeDelta } },
        select: { likeCount: true, dislikeCount: true },
      });
      return { likes: Math.max(0, post.likeCount), dislikes: Math.max(0, post.dislikeCount), myVote };
    });
  } catch {
    // 并发撞唯一键(P2002)等 → 返回当前真实状态,不抛 500
    return snapshot(postId, voterKey);
  }
}
