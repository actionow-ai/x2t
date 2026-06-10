import { describe, it, expect } from "vitest";
import { buildBelief, beliefClauseFromStored } from "./belief";
import type { Calibration } from "./stance";

const base: Calibration = { samples: 20, recencyWeightedRate: 0.55, brier: 0.2, h5Rate: 0.5, h20Rate: 0.5 };

describe("buildBelief(规则化信念)", () => {
  it("无校准/无近期加权 → 空", () => {
    expect(buildBelief(null)).toEqual([]);
    expect(buildBelief({ ...base, recencyWeightedRate: null })).toEqual([]);
  });
  it("近期加权 < 0.45 → recency_weak", () => {
    expect(buildBelief({ ...base, recencyWeightedRate: 0.4 })).toContain("recency_weak");
  });
  it("近期加权 > 0.6 → recency_strong", () => {
    expect(buildBelief({ ...base, recencyWeightedRate: 0.7 })).toContain("recency_strong");
  });
  it("5日命中明显高于20日 → short_term;反之 mid_term", () => {
    expect(buildBelief({ ...base, h5Rate: 0.7, h20Rate: 0.5 })).toContain("short_term");
    expect(buildBelief({ ...base, h5Rate: 0.5, h20Rate: 0.7 })).toContain("mid_term");
  });
  it("Brier > 0.3 → poor_calibration;最多 2 条", () => {
    const codes = buildBelief({ ...base, recencyWeightedRate: 0.4, h5Rate: 0.7, h20Rate: 0.5, brier: 0.4 });
    expect(codes.length).toBeLessThanOrEqual(2);
  });
});

describe("beliefClauseFromStored", () => {
  it("还原 prompt 片段,忽略非法 code", () => {
    expect(beliefClauseFromStored("recency_weak,short_term")).toContain("跑输");
    expect(beliefClauseFromStored("recency_weak,bogus")).not.toContain("bogus");
    expect(beliefClauseFromStored(null)).toBe("");
  });
});
