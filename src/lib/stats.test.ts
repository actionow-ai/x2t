import { describe, it, expect } from "vitest";
import { binomTestGreater, benjaminiHochberg } from "./stats";

describe("binomTestGreater(精确二项,单侧 P(X>=beats))", () => {
  it("n=10 beats=8 p0=0.5 = 56/1024(正态近似会低估近半)", () => {
    expect(binomTestGreater(8, 10)).toBeCloseTo(56 / 1024, 10);
  });
  it("n=10 beats=10 = 1/1024", () => {
    expect(binomTestGreater(10, 10)).toBeCloseTo(1 / 1024, 12);
  });
  it("n=10 beats=5 = 638/1024", () => {
    expect(binomTestGreater(5, 10)).toBeCloseTo(638 / 1024, 10);
  });
  it("边界:n=0→1、beats=0→1、beats>n→0", () => {
    expect(binomTestGreater(0, 0)).toBe(1);
    expect(binomTestGreater(0, 10)).toBe(1);
    expect(binomTestGreater(11, 10)).toBe(0);
  });
  it("大 n 不溢出(对数空间)", () => {
    const p = binomTestGreater(160, 300);
    expect(p).toBeGreaterThan(0);
    expect(p).toBeLessThan(1);
  });
});

describe("benjaminiHochberg(FDR)", () => {
  it("空输入返回空", () => {
    expect(benjaminiHochberg([])).toEqual([]);
  });
  it("全大 p 全部不拒绝", () => {
    expect(benjaminiHochberg([0.4, 0.6, 0.9], 0.1)).toEqual([false, false, false]);
  });
  it("经典 step-up:p=[.01...05] α=.05 全拒绝", () => {
    expect(benjaminiHochberg([0.01, 0.02, 0.03, 0.04, 0.05], 0.05)).toEqual([true, true, true, true, true]);
  });
  it("结果顺序对应输入顺序(非排序后)", () => {
    // sorted [(0.001,idx1),(0.9,idx0)];仅 idx1 显著
    expect(benjaminiHochberg([0.9, 0.001], 0.1)).toEqual([false, true]);
  });
});
