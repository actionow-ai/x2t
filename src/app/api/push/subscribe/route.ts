import { z } from "zod";
import { savePushSubscription } from "@/lib/push";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

// 推送端点必须是已知推送服务域名(防 notify 时 server 向任意 URL 发 POST = SSRF/滥用)
const PUSH_HOSTS = [".googleapis.com", ".apple.com", ".mozilla.com", ".microsoft.com", ".windows.com"];
function validPushEndpoint(u: string): boolean {
  try {
    const h = new URL(u);
    return h.protocol === "https:" && PUSH_HOSTS.some((s) => h.hostname.endsWith(s));
  } catch {
    return false;
  }
}

const schema = z.object({
  endpoint: z.string().url().max(800).refine(validPushEndpoint, "unsupported push endpoint host"),
  keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(200) }),
  followFilter: z.array(z.string().max(40)).max(500).default([]), // 限长度防表膨胀
});

// 保存 web-push 订阅（含关注列表镜像）。匿名可用,但限流。
export async function POST(request: Request) {
  if (!(await rateLimit(`push:ip:${clientIp(request)}`, 30, 3_600_000))) {
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
