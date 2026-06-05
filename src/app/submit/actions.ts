"use server";

import { prisma } from "@/lib/db";
import { storePost } from "@/lib/ingest";
import { redirect } from "next/navigation";

export async function submitPost(formData: FormData) {
  const handle = String(formData.get("handle") ?? "").trim();
  const displayName = String(formData.get("displayName") ?? "").trim() || null;
  const contentText = String(formData.get("contentText") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim() || null;

  if (!handle || !contentText) {
    throw new Error("handle 和帖子内容必填");
  }

  const influencer = await prisma.influencer.upsert({
    where: { platform_handle: { platform: "manual", handle } },
    create: { handle, platform: "manual", displayName, sourceConfig: { connector: "manual" } },
    update: displayName ? { displayName } : {},
  });

  await storePost(influencer.id, {
    platformPostId: `manual-${Date.now()}`,
    url: url ?? undefined,
    contentText,
    postedAt: new Date(),
  });

  redirect("/");
}
