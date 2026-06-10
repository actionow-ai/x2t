import dns from "node:dns/promises";
import net from "node:net";

// SSRF 守卫(从 api/img 抽出,供图片代理 / RSS / 价格抓取等所有"服务端拉外部 URL"复用)。

// 私网 / 回环 / 链路本地 / 云元数据(169.254.169.254)—— 防打内网与窃取云凭据。
export function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)
    );
  }
  const l = ip.toLowerCase();
  return l === "::1" || l.startsWith("fc") || l.startsWith("fd") || l.startsWith("fe80") || l.includes("127.") || l.includes("169.254") || l.includes("10.") || l.includes("192.168");
}

// host 解析出的 IP 是否全为公网(DNS 解析失败返回 true,交由 fetch 自然失败,不误伤正常域名)。
export async function hostResolvesPublic(host: string): Promise<boolean> {
  try {
    const addrs = await dns.lookup(host, { all: true });
    return addrs.length > 0 && !addrs.some((a) => isPrivateIp(a.address));
  } catch {
    return true;
  }
}
