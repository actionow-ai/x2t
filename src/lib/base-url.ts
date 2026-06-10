// 反向代理（Zeabur 等）后，request.url 的 host 是内网地址（如 localhost:8080）。
// 还原对外公网地址：优先 APP_URL，其次 X-Forwarded-Host/Proto，最后回退到 request origin。
import { SITE_URL } from "./seo";

export function baseUrl(request: Request): string {
  const env = process.env.APP_URL;
  if (env) return env.replace(/\/$/, "");
  // 生产未配 APP_URL:回退固定主域名(SITE_URL),不信任 X-Forwarded-Host/Host
  // —— 防 Host 头投毒构造开放重定向(安全 LOW)。开发态仍用请求 Host 便于本地调试。
  if (process.env.NODE_ENV === "production") return SITE_URL;
  const h = request.headers;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = (h.get("x-forwarded-proto") ?? "https").split(",")[0].trim();
  if (host) return `${proto}://${host}`;
  return new URL(request.url).origin;
}
