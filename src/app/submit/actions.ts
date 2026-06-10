"use server";

import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import { storePost } from "@/lib/ingest";
import { requireUserId } from "@/lib/auth";
import { rateLimit } from "@/lib/ratelimit";
import { redirect } from "next/navigation";

export async function submitPost(formData: FormData) {
  // 鉴权:必须登录且会话未撤销(杜绝匿名灌库 + 触发全员推送)
  const uid = await requireUserId();
  if (!uid) redirect("/login"); // 跳登录页,而非 throw(生产 Next 会把错误脱敏成 digest,用户看不到原因)
  if (!(await rateLimit(`submit:${uid}`, 10, 60 * 60 * 1000))) throw new Error("提交过于频繁，请稍后再试");

  const handle = String(formData.get("handle") ?? "").trim().slice(0, 64);
  const dn = String(formData.get("displayName") ?? "").trim().slice(0, 80);
  const displayName = dn || null;
  const contentText = String(formData.get("contentText") ?? "").trim().slice(0, 4000);
  const url = (String(formData.get("url") ?? "").trim().slice(0, 500)) || null;

  if (!handle || !contentText) throw new Error("handle 和帖子内容必填");

  const influencer = await prisma.influencer.upsert({
    where: { platform_handle: { platform: "manual", handle } },
    create: { handle, platform: "manual", displayName, sourceConfig: { connector: "manual" } },
    update: displayName ? { displayName } : {},
  });

  // 幂等去重:基于 url 或内容哈希(而非时间戳),防重复提交产生重复帖
  const dedup = url ? `url:${url}` : `h:${crypto.createHash("sha1").update(contentText).digest("hex").slice(0, 24)}`;
  await storePost(influencer.id, {
    platformPostId: `manual-${dedup}`,
    url: url ?? undefined,
    contentText,
    postedAt: new Date(),
  });

  // 用户手工提交(platform=manual)不触发全员推送——防以他人名义群发未验证内容(合规)
  redirect("/");
}
