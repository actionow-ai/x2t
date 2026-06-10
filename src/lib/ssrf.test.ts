import { describe, it, expect } from "vitest";
import { isPrivateIp } from "./ssrf";

describe("isPrivateIp", () => {
  it("挡私网/回环/链路本地/元数据 IPv4", () => {
    for (const ip of ["127.0.0.1", "10.0.0.1", "192.168.1.1", "172.16.0.1", "169.254.169.254", "100.64.0.1", "0.0.0.0"]) {
      expect(isPrivateIp(ip)).toBe(true);
    }
  });
  it("放行公网 IPv4", () => {
    for (const ip of ["8.8.8.8", "1.1.1.1", "104.16.0.1"]) expect(isPrivateIp(ip)).toBe(false);
  });
  it("挡 IPv4-mapped IPv6 的点分与十六进制形(原子串匹配可绕过,sec-1)", () => {
    expect(isPrivateIp("::ffff:169.254.169.254")).toBe(true);
    expect(isPrivateIp("::ffff:a9fe:a9fe")).toBe(true); // 169.254.169.254 十六进制
    expect(isPrivateIp("0:0:0:0:0:ffff:a9fe:a9fe")).toBe(true);
    expect(isPrivateIp("::ffff:0a00:0001")).toBe(true); // 10.0.0.1 十六进制
    expect(isPrivateIp("64:ff9b::a9fe:a9fe")).toBe(true); // NAT64
  });
  it("挡纯 IPv6 私网/回环 + 去 zone", () => {
    expect(isPrivateIp("::1")).toBe(true);
    expect(isPrivateIp("fe80::1%eth0")).toBe(true);
    expect(isPrivateIp("fd00::1")).toBe(true);
  });
  it("放行公网 IPv6", () => {
    expect(isPrivateIp("2606:4700:4700::1111")).toBe(false);
  });
});
