import { z } from "zod";
import { savePushSubscription } from "@/lib/push";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

const schema = z.object({
  endpoint: z.string().url().max(800),
  keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(200) }),
  followFilter: z.array(z.string().max(40)).max(500).default([]), // 限长度防表膨胀
});

// 保存 web-push 订阅（含关注列表镜像）。匿名可用,但限流。
export async function POST(request: Request) {
  if (!rateLimit(`push:ip:${clientIp(request)}`, 30, 3_600_000)) {
    return Response.json({ error: "too many requests" }, { status: 429 });
  }
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
