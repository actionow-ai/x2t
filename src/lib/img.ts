// 外域图片(尤其 pbs.twimg.com / abs.twimg.com,在中国大陆被墙)走自家代理 /api/img:
// 由服务器拉取再回传本域,绕过地域封锁与防盗链。本域/相对/data URL 原样返回。
export function proxiedImg(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("/") || url.startsWith("data:")) return url;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return url;
    return `/api/img?u=${encodeURIComponent(url)}`;
  } catch {
    return url;
  }
}
