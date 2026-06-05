import { z } from "zod";
import { savePushSubscription } from "@/lib/push";

export const dynamic = "force-dynamic";

const schema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string(), auth: z.string() }),
  followFilter: z.array(z.string()).default([]),
});

// 保存 web-push 订阅（含关注列表镜像）。匿名可用。
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const sub = await savePushSubscription(parsed.data);
  return Response.json({ ok: true, id: sub.id });
}
