import { describe, it, expect, beforeEach } from "vitest";
import { parseEndpoints, createFallback } from "./config";
import type { LlmProvider } from "./types";

const KEYS = ["LLM_API_KEY", "LLM_BASE_URL", "LLM_MODEL", "TRANSLATE_MODEL"];
function clearLlmEnv() {
  for (const k of Object.keys(process.env)) if (k.startsWith("LLM_") || k.startsWith("TRANSLATE_")) delete process.env[k];
}

describe("parseEndpoints(多 provider 解析)", () => {
  beforeEach(clearLlmEnv);

  it("无 LLM_API_KEY → 空", () => {
    expect(parseEndpoints()).toEqual([]);
  });

  it("主端点 + _2 兜底", () => {
    process.env.LLM_API_KEY = "k1";
    process.env.LLM_BASE_URL = "https://u1/v1";
    process.env.LLM_MODEL = "m1";
    process.env.LLM_API_KEY_2 = "k2";
    process.env.LLM_MODEL_2 = "m2";
    const eps = parseEndpoints();
    expect(eps).toHaveLength(2);
    expect(eps[0]).toMatchObject({ apiKey: "k1", baseURL: "https://u1/v1", model: "m1" });
    expect(eps[1]).toMatchObject({ apiKey: "k2", model: "m2" });
  });

  it("translateModel 缺省回退到该端点的 model", () => {
    process.env.LLM_API_KEY = "k";
    process.env.LLM_MODEL = "big";
    expect(parseEndpoints()[0].translateModel).toBe("big");
  });

  it("TRANSLATE_MODEL 显式则用之", () => {
    process.env.LLM_API_KEY = "k";
    process.env.LLM_MODEL = "big";
    process.env.TRANSLATE_MODEL = "small";
    expect(parseEndpoints()[0].translateModel).toBe("small");
  });

  it("编号断档即停(_2 缺则不读 _3)", () => {
    process.env.LLM_API_KEY = "k1";
    process.env.LLM_API_KEY_3 = "k3";
    expect(parseEndpoints()).toHaveLength(1);
  });
});

describe("createFallback(顺序兜底)", () => {
  const mk = (name: string, fn: () => Promise<string>): LlmProvider => ({ name, completeJson: fn });

  it("单 provider 直接透传(不包装)", () => {
    const p = mk("solo", async () => "x");
    expect(createFallback([p])).toBe(p);
  });

  it("首个成功即返回,不调后续", async () => {
    let called2 = false;
    const f = createFallback([
      mk("a", async () => "OK"),
      mk("b", async () => {
        called2 = true;
        return "x";
      }),
    ]);
    expect(await f.completeJson("s", "u")).toBe("OK");
    expect(called2).toBe(false);
  });

  it("首个抛错 → 降级第二个", async () => {
    const f = createFallback([
      mk("a", async () => {
        throw new Error("dead channel");
      }),
      mk("b", async () => "OK2"),
    ]);
    expect(await f.completeJson("s", "u")).toBe("OK2");
  });

  it("首个空响应 → 降级第二个", async () => {
    const f = createFallback([mk("a", async () => "   "), mk("b", async () => "OK3")]);
    expect(await f.completeJson("s", "u")).toBe("OK3");
  });

  it("全挂 → 抛聚合错误(含各端点原因)", async () => {
    const f = createFallback([
      mk("a", async () => {
        throw new Error("e1");
      }),
      mk("b", async () => ""),
    ]);
    await expect(f.completeJson("s", "u")).rejects.toThrow(/所有 LLM provider 失败.*e1.*空响应/s);
  });
});
