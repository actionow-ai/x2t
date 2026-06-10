import { describe, it, expect } from "vitest";
import { wilson95 } from "./stance";

describe("wilson95 置信区间", () => {
  it("p=0.5 n=20 → CI 约 [0.30, 0.70]", () => {
    const [lo, hi] = wilson95(10, 20);
    expect(lo).toBeGreaterThan(0.28);
    expect(lo).toBeLessThan(0.32);
    expect(hi).toBeGreaterThan(0.68);
    expect(hi).toBeLessThan(0.72);
  });

  it("n=0 → [0,1](无样本=无信息,全区间)", () => {
    expect(wilson95(0, 0)).toEqual([0, 1]);
  });

  it("全命中时上界封顶 1、不越界", () => {
    const [lo, hi] = wilson95(30, 30);
    expect(hi).toBeLessThanOrEqual(1);
    expect(lo).toBeGreaterThan(0.85);
  });

  it("样本越大区间越窄", () => {
    const a = wilson95(10, 20);
    const b = wilson95(100, 200);
    expect(b[1] - b[0]).toBeLessThan(a[1] - a[0]);
  });

  it("n=20 的 50% 下界 < 0.5 —— 与抛硬币不可区分(胜率门槛的依据)", () => {
    const [lo] = wilson95(10, 20);
    expect(lo).toBeLessThan(0.5);
  });
});
