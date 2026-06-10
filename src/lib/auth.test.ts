import { describe, it, expect } from "vitest";
import { sessionCookieValue, parseSessionToken } from "./auth";

describe("会话 token 签名/解析(HMAC)", () => {
  it("round-trip:签发后能解析回 userId + tokenVersion", () => {
    const tok = sessionCookieValue("user_abc", 3);
    expect(parseSessionToken(tok)).toEqual({ userId: "user_abc", tv: 3 });
  });
  it("篡改签名(改尾部、保持长度)→ null", () => {
    const tok = sessionCookieValue("user_abc", 3);
    const tampered = tok.slice(0, -2) + (tok.endsWith("a") ? "bb" : "aa");
    expect(parseSessionToken(tampered)).toBeNull();
  });
  it("篡改 payload(改 userId)→ null,签名不匹配", () => {
    const tok = sessionCookieValue("user_abc", 3);
    const sig = tok.slice(tok.lastIndexOf("."));
    expect(parseSessionToken("user_evil:3" + sig)).toBeNull();
  });
  it("垃圾/旧格式 token → null", () => {
    expect(parseSessionToken("garbage")).toBeNull();
    expect(parseSessionToken("")).toBeNull();
  });
});
