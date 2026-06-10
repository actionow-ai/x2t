import dns from "node:dns/promises";
import net from "node:net";

// SSRF 守卫(从 api/img 抽出,供图片代理 / RSS / 价格抓取等所有"服务端拉外部 URL"复用)。

// IPv4-mapped IPv6 的点分或十六进制尾巴 → 还原内嵌 IPv4(::ffff:169.254.169.254 / ::ffff:a9fe:a9fe / 0:0:0:0:0:ffff:...)。
function extractMappedV4(addr: string): string | null {
  // 仅匹配真正的 IPv4-mapped 前缀(::ffff: 或全零高位 0:0:0:0:0:ffff:),避免误伤碰巧以 ffff 结尾的公网 IPv6
  const m0 = addr.match(/^(?:::ffff:|(?:0:){5}ffff:)(.+)$/i);
  if (!m0) return null;
  const tail = m0[1];
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(tail)) return tail;
  const hx = tail.match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
  if (hx) {
    const n = (parseInt(hx[1], 16) * 65536 + parseInt(hx[2], 16)) >>> 0;
    return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
  }
  return null;
}

// 私网 / 回环 / 链路本地 / 云元数据(169.254.169.254)/ NAT64 —— 防打内网与窃取云凭据。
// 不再用脆弱子串匹配:IPv4-mapped IPv6 十六进制形(::ffff:a9fe:a9fe)等价于点分,显式还原后按 v4 判定(sec-1)。
export function isPrivateIp(ip: string): boolean {
  let addr = ip.toLowerCase().trim();
  const zone = addr.indexOf("%");
  if (zone >= 0) addr = addr.slice(0, zone); // 去 IPv6 zone(fe80::1%eth0)
  const mapped = extractMappedV4(addr);
  if (mapped) return isPrivateIp(mapped);
  if (net.isIPv4(addr)) {
    const [a, b] = addr.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)
    );
  }
  // 纯 IPv6:回环/未指定/唯一本地(fc/fd)/链路本地(fe80)/ NAT64(64:ff9b::)
  return addr === "::1" || addr === "::" || addr.startsWith("fc") || addr.startsWith("fd") || addr.startsWith("fe80") || addr.startsWith("64:ff9b:");
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
