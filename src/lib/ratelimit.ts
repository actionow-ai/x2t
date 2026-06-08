// 进程内滑动窗口限流（单容器足够；多实例需换 Redis/Upstash）。
const buckets = new Map<string, number[]>();

/** 返回 true=放行，false=超限。key 建议带维度前缀，如 `login:ip:1.2.3.4`。 */
export function rateLimit(key: string, max: number, windowMs: number): boolean {
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

/** 从请求头取客户端 IP（Zeabur/反代）。*/
export function clientIp(req: Request): string {
  const h = req.headers;
  return (h.get("x-forwarded-for")?.split(",")[0] || h.get("x-real-ip") || "unknown").trim();
}
