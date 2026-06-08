"use server";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export async function deletePost(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (id) await prisma.post.delete({ where: { id } }).catch(() => {});
  revalidatePath("/admin/posts");
}

export async function reanalyzePost(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (id) await prisma.post.update({ where: { id }, data: { analysisStatus: "pending" } }).catch(() => {});
  revalidatePath("/admin/posts");
}

export async function deleteUser(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (id) await prisma.user.delete({ where: { id } }).catch(() => {});
  revalidatePath("/admin/users");
}

export async function toggleInfluencer(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const inf = await prisma.influencer.findUnique({ where: { id } });
  if (inf) await prisma.influencer.update({ where: { id }, data: { active: !inf.active } });
  revalidatePath("/admin/influencers");
}

export async function deleteInfluencer(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (id) await prisma.influencer.delete({ where: { id } }).catch(() => {});
  revalidatePath("/admin/influencers");
}

const addSchema = z.object({
  handle: z.string().min(1),
  displayName: z.string().optional(),
  feedUrl: z.string().optional(),
});

export async function addInfluencer(formData: FormData) {
  await requireAdmin();
  const parsed = addSchema.safeParse({
    handle: String(formData.get("handle") ?? "").trim(),
    displayName: String(formData.get("displayName") ?? "").trim() || undefined,
    feedUrl: String(formData.get("feedUrl") ?? "").trim() || undefined,
  });
  if (!parsed.success) return;
  const { handle, displayName, feedUrl } = parsed.data;
  await prisma.influencer.upsert({
    where: { platform_handle: { platform: "twitter", handle } },
    create: {
      handle,
      platform: "twitter",
      displayName: displayName ?? null,
      sourceConfig: { connector: "rss", feedUrl: feedUrl ?? "" },
    },
    update: {
      displayName: displayName ?? undefined,
      sourceConfig: { connector: "rss", feedUrl: feedUrl ?? "" },
    },
  });
  revalidatePath("/admin/influencers");
}
