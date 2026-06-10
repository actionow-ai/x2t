import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

// 当前用户关注的博主 id 列表
export async function GET() {
  const userId = await requireUserId();
  if (!userId) return Response.json({ loggedIn: false, follows: [] });
  const rows = await prisma.follow.findMany({ where: { userId }, select: { influencerId: true } });
  return Response.json({ loggedIn: true, follows: rows.map((r) => r.influencerId) });
}

const schema = z.object({ influencerId: z.string() });

// 切换关注（登录用户写 follows 表，云同步）
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

  const { influencerId } = parsed.data;
  const existing = await prisma.follow.findUnique({ where: { userId_influencerId: { userId, influencerId } } });
  if (existing) {
    await prisma.follow.delete({ where: { userId_influencerId: { userId, influencerId } } });
    return Response.json({ following: false });
  }
  await prisma.follow.create({ data: { userId, influencerId } }).catch(() => {});
  return Response.json({ following: true });
}
