import { describe, it, expect } from "vitest";
import { proxiedImg } from "./img";

describe("proxiedImg", () => {
  it("外域 https 图 → 经 /api/img 代理", () => {
    const out = proxiedImg("https://pbs.twimg.com/profile_images/1/abc.jpg");
    expect(out).toMatch(/^\/api\/img\?u=/);
    expect(out).toContain(encodeURIComponent("https://pbs.twimg.com/profile_images/1/abc.jpg"));
  });
  it("本域/相对路径 → 原样", () => {
    expect(proxiedImg("/og.png")).toBe("/og.png");
  });
  it("data URL → 原样", () => {
    expect(proxiedImg("data:image/png;base64,AAAA")).toBe("data:image/png;base64,AAAA");
  });
  it("空/undefined → undefined", () => {
    expect(proxiedImg(undefined)).toBeUndefined();
    expect(proxiedImg(null)).toBeUndefined();
    expect(proxiedImg("")).toBeUndefined();
  });
});
