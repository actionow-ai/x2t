"use server";

import { prisma } from "./db";
import { getVoterKey } from "./reactions";

export type ReactResult = { likes: number; dislikes: number; myVote: number };

// 赞/踩(value 1/-1):同票再点=取消;反向点=切换。返回新计数 + 我的当前票。计数去规范化到 Post。
export async function reactToPost(postId: string, value: 1 | -1): Promise<ReactResult> {
  const voterKey = await getVoterKey(true);
  if (!voterKey) return { likes: 0, dislikes: 0, myVote: 0 };

  const existing = await prisma.postReaction.findUnique({ where: { postId_voterKey: { postId, voterKey } } });
  let likeDelta = 0;
  let dislikeDelta = 0;
  let myVote: number = value;

  if (!existing) {
    await prisma.postReaction.create({ data: { postId, voterKey, value } });
    if (value === 1) likeDelta = 1;
    else dislikeDelta = 1;
  } else if (existing.value === value) {
    await prisma.postReaction.delete({ where: { postId_voterKey: { postId, voterKey } } }); // 再点取消
    if (value === 1) likeDelta = -1;
    else dislikeDelta = -1;
    myVote = 0;
  } else {
    await prisma.postReaction.update({ where: { postId_voterKey: { postId, voterKey } }, data: { value } }); // 切换
    if (value === 1) {
      likeDelta = 1;
      dislikeDelta = -1;
    } else {
      likeDelta = -1;
      dislikeDelta = 1;
    }
  }

  const post = await prisma.post.update({
    where: { id: postId },
    data: { likeCount: { increment: likeDelta }, dislikeCount: { increment: dislikeDelta } },
    select: { likeCount: true, dislikeCount: true },
  });
  return { likes: Math.max(0, post.likeCount), dislikes: Math.max(0, post.dislikeCount), myVote };
}
