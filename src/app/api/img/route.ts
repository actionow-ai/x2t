import dns from "node:dns/promises";
import net from "node:net";
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

// 私网 / 回环 / 链路本地 / 元数据地址 —— 防 SSRF 打内网与云元数据(169.254.169.254)
function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  const l = ip.toLowerCase();
  return l === "::1" || l.startsWith("fc") || l.startsWith("fd") || l.startsWith("fe80") || l.includes("127.") || l.includes("169.254") || l.includes("10.") || l.includes("192.168");
}

// host 既在白名单、解析出的 IP 又非私网才放行(DNS 解析失败不阻断,交由 fetch 自然失败)
async function hostSafe(host: string): Promise<boolean> {
  if (!allowedHost(host)) return false;
  try {
    const addrs = await dns.lookup(host, { all: true });
    return addrs.length > 0 && !addrs.some((a) => isPrivateIp(a.address));
  } catch {
    return true;
  }
}

const MAX_BYTES = 3 * 1024 * 1024; // 3MB 上限
const TIMEOUT = () => AbortSignal.timeout(Number(process.env.IMG_PROXY_TIMEOUT_MS ?? 8000));
const UA = "Mozilla/5.0 (compatible; X2T/1.0; +https://x2t.actionow.ai)";

// 手动跟随重定向:每一跳都复检 https + 白名单 + 私网 IP(默认 fetch 跟随重定向会绕过首跳校验 → SSRF)
async function fetchFollow(url: URL, depth = 0): Promise<Response> {
  if (depth > 3) throw new Error("too many redirects");
  if (url.protocol !== "https:") throw new Error("https only");
  if (!(await hostSafe(url.hostname))) throw new Error("host not allowed");
  const res = await fetch(url.toString(), {
    headers: { "User-Agent": UA, Accept: "image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8" },
    redirect: "manual",
    signal: TIMEOUT(),
  });
  if (res.status >= 300 && res.status < 400) {
    const loc = res.headers.get("location");
    if (!loc) throw new Error("redirect without location");
    return fetchFollow(new URL(loc, url), depth + 1);
  }
  return res;
}

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
    const upstream = await fetchFollow(target);
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
        "Cache-Control": "public, max-age=86400, s-maxage=2592000, stale-while-revalidate=86400",
      },
    });
  } catch {
    return new Response("fetch failed", { status: 502 });
  }
}
