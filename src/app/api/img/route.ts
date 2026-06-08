import { rateLimit, clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 仅代理这些图片 CDN 的域名(防开放代理 / SSRF)。按支持的平台列常见头像/图片源。
const ALLOW_SUFFIX = [
  ".twimg.com", // pbs / abs.twimg.com(X 头像,大陆被墙)
  ".dicebear.com",
  ".marketwatch.com",
  ".redditmedia.com",
  ".redditstatic.com",
  ".redd.it",
  ".substackcdn.com",
  ".substack.com",
  ".ggpht.com", // youtube 头像
  ".ytimg.com",
  ".licdn.com",
];
const ALLOW_EXACT = new Set(["pbs.twimg.com", "abs.twimg.com", "api.dicebear.com", "marketwatch.com"]);

function allowedHost(host: string): boolean {
  const h = host.toLowerCase();
  return ALLOW_EXACT.has(h) || ALLOW_SUFFIX.some((s) => h.endsWith(s));
}

const MAX_BYTES = 3 * 1024 * 1024; // 3MB 上限

export async function GET(req: Request) {
  if (!rateLimit(`img:${clientIp(req)}`, 600, 60_000)) {
    return new Response("too many requests", { status: 429 });
  }
  const raw = new URL(req.url).searchParams.get("u");
  if (!raw) return new Response("missing u", { status: 400 });

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return new Response("bad url", { status: 400 });
  }
  if (target.protocol !== "https:") return new Response("https only", { status: 400 });
  if (!allowedHost(target.hostname)) return new Response("host not allowed", { status: 403 });

  try {
    const upstream = await fetch(target.toString(), {
      headers: {
        // 带常规 UA + Referer,绕过部分防盗链
        "User-Agent": "Mozilla/5.0 (compatible; X2T/1.0; +https://x2t.actionow.ai)",
        Accept: "image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(Number(process.env.IMG_PROXY_TIMEOUT_MS ?? 8000)),
    });
    if (!upstream.ok) return new Response("upstream " + upstream.status, { status: 502 });
    const ct = upstream.headers.get("content-type") ?? "";
    if (!ct.startsWith("image/")) return new Response("not an image", { status: 415 });

    const buf = await upstream.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) return new Response("too large", { status: 413 });

    return new Response(buf, {
      status: 200,
      headers: {
        "Content-Type": ct,
        "Content-Length": String(buf.byteLength),
        // 浏览器缓存 1 天,CDN/边缘缓存 30 天 —— 头像极少变,省带宽
        "Cache-Control": "public, max-age=86400, s-maxage=2592000, stale-while-revalidate=86400",
      },
    });
  } catch {
    return new Response("fetch failed", { status: 502 });
  }
}
