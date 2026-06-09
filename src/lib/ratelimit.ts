import Redis from "ioredis";

// 限流：配了 REDIS_URL 就用 Redis 固定窗口(跨实例/重启共享);否则进程内内存兜底。
// Redis 任何错误都降级到内存,绝不因 Redis 抖动误伤正常请求。

// ---- 内存后端(单容器兜底) ----
const buckets = new Map<string, number[]>();
function memoryAllow(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const arr = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) {
    buckets.set(key, arr);
    return false;
  }
  arr.push(now);
  buckets.set(key, arr);
  // 轻量防泄漏：桶过多时清理空/过期桶
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (!v.some((t) => now - t < windowMs)) buckets.delete(k);
  }
  return true;
}

// ---- Redis 后端(可选,多实例共享) ----
let _redis: Redis | null | undefined;
function getRedis(): Redis | null {
  if (_redis !== undefined) return _redis;
  const url = process.env.REDIS_URL;
  if (!url) return (_redis = null);
  try {
    const r = new Redis(url, { maxRetriesPerRequest: 1, enableOfflineQueue: false, lazyConnect: false });
    r.on("error", () => {}); // 静默:连接异常由各调用 try/catch 降级到内存
    _redis = r;
  } catch {
    _redis = null;
  }
  return _redis;
}

/** 返回 true=放行，false=超限。key 建议带维度前缀，如 `login:ip:1.2.3.4`。 */
export async function rateLimit(key: string, max: number, windowMs: number): Promise<boolean> {
  const r = getRedis();
  if (r) {
    try {
      const k = `rl:${key}`;
      const n = await r.incr(k);
      if (n === 1) await r.pexpire(k, windowMs);
      return n <= max;
    } catch {
      // Redis 不可用 → 降级到内存,不阻断请求
    }
  }
  return memoryAllow(key, max, windowMs);
}

/** 从请求头取客户端 IP（Zeabur/反代）。*/
export function clientIp(req: Request): string {
  const h = req.headers;
  return (h.get("x-forwarded-for")?.split(",")[0] || h.get("x-real-ip") || "unknown").trim();
}
