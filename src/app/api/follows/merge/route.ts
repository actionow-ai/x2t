import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

const schema = z.object({ influencerIds: z.array(z.string()) });

// 登录后把浏览器本地关注列表并入服务端 follows（幂等）
export async function POST(request: Request) {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "not logged in" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "invalid" }, { status: 400 });

  const valid = await prisma.influencer.findMany({
    where: { id: { in: parsed.data.influencerIds } },
    select: { id: true },
  });
  for (const v of valid) {
    await prisma.follow.upsert({
      where: { userId_influencerId: { userId, influencerId: v.id } },
      create: { userId, influencerId: v.id },
      update: {},
    });
  }
  return Response.json({ ok: true, merged: valid.length });
}
