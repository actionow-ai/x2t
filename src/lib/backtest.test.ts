import { describe, it, expect } from "vitest";
import { settleCalls, wilson95, type RawCall, type PricePoint } from "./stance";

const DAY = 86_400_000;
const series = (closes: number[]): PricePoint[] => closes.map((close, i) => ({ t: i * DAY, close }));
// 平稳 SPY:每日 +1(100,101,…),便于手算基准收益
const spy = series(Array.from({ length: 30 }, (_, i) => 100 + i));
const at = (day: number) => day * DAY;

describe("settleCalls(回测配对结算)", () => {
  it("多头跑赢 SPY → beat", () => {
    const Y = series([100, 100, 100, 100, 100, 130]);
    const calls: RawCall[] = [{ symbol: "Y", stance: "bullish", postedAtMs: at(0) - 1 }];
    const r = settleCalls(calls, new Map([["Y", Y]]), spy, 5);
    expect(r).toHaveLength(1);
    expect(r[0].aligned).toBeCloseTo(0.3, 6); // 入场 day0=100 出场 day5=130
    expect(r[0].excess).toBeCloseTo(0.3 - 5 / 100, 6); // 减同期 SPY +5%
    expect(r[0].beat).toBe(true);
  });

  it("消除盘后 look-ahead:发帖时刻晚于当日开盘 → 次一交易日入场", () => {
    // day3 收盘 20 在发帖时已知;正确入场是 day4 收盘 30。horizon=1 放大差异。
    const Y = series([0, 0, 0, 20, 30, 60]);
    const calls: RawCall[] = [{ symbol: "Y", stance: "bullish", postedAtMs: at(3) + 50_000_000 }]; // day3 当天晚些
    const r = settleCalls(calls, new Map([["Y", Y]]), spy, 1);
    expect(r).toHaveLength(1);
    expect(r[0].aligned).toBeCloseTo(1.0, 6); // (60-30)/30=1.0(若错用 day3=20 则为 0.5)
  });

  it("伪重复样本:同向 horizon 内重复 call 只计一次", () => {
    const Y = series(Array.from({ length: 10 }, (_, i) => 100 + i));
    const calls: RawCall[] = [
      { symbol: "Y", stance: "bullish", postedAtMs: at(0) - 1 },
      { symbol: "Y", stance: "bullish", postedAtMs: at(2) - 1 }, // 间隔 2 < horizon5 → 合并
    ];
    const r = settleCalls(calls, new Map([["Y", Y]]), spy, 5);
    expect(r).toHaveLength(1);
  });

  it("flip 截断:反向 call 触发前一持仓提前平仓", () => {
    const Y = series([100, 101, 102, 103, 104, 105, 106, 107, 108, 109]);
    const calls: RawCall[] = [
      { symbol: "Y", stance: "bullish", postedAtMs: at(0) - 1 }, // ei0
      { symbol: "Y", stance: "bearish", postedAtMs: at(2) - 1 }, // ei2 反向 → 截断 call1 到 day2
    ];
    const r = settleCalls(calls, new Map([["Y", Y]]), spy, 5);
    expect(r).toHaveLength(2);
    expect(r[0].aligned).toBeCloseTo(0.02, 6); // day0→day2(若不截断按 day5 则 0.05)
    expect(r[1].aligned).toBeLessThan(0); // 看空但标的上涨
  });

  it("空头对照做空 SPY(市场中性):看空者超额 = aligned + spyRet", () => {
    const Y = series([100, 100, 100, 100, 100, 90]);
    const calls: RawCall[] = [{ symbol: "Y", stance: "bearish", postedAtMs: at(0) - 1 }];
    const r = settleCalls(calls, new Map([["Y", Y]]), spy, 5);
    expect(r).toHaveLength(1);
    expect(r[0].aligned).toBeCloseTo(0.1, 6); // 标的跌 10% → 看空对齐收益 +10%
    expect(r[0].excess).toBeCloseTo(0.1 + 5 / 100, 6); // benchRet = -spyRet,故 excess = 0.10 - (-0.05)
    expect(r[0].beat).toBe(true);
  });

  it("无基准价则无样本", () => {
    const Y = series([100, 110, 120, 130, 140, 150]);
    const calls: RawCall[] = [{ symbol: "Y", stance: "bullish", postedAtMs: at(0) - 1 }];
    expect(settleCalls(calls, new Map([["Y", Y]]), [], 5)).toHaveLength(0);
  });
});

describe("wilson95 边界", () => {
  it("n=0 返回全区间 [0,1](无信息)", () => {
    expect(wilson95(0, 0)).toEqual([0, 1]);
  });
});
