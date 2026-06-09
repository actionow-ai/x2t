import { describe, it, expect } from "vitest";
import { extractCashtags, isValidSymbol, NOT_TICKERS } from "./symbol";

describe("extractCashtags", () => {
  it("拉出 $代码、去重、转大写", () => {
    expect(extractCashtags("love $nvda and $NVDA, also $brk.b")).toEqual(["NVDA", "BRK.B"]);
  });
  it("空文本 → 空数组", () => {
    expect(extractCashtags("no tickers here")).toEqual([]);
  });
  it("多次调用结果稳定(不受 /g lastIndex 影响)", () => {
    const a = extractCashtags("$AAPL $MSFT");
    const b = extractCashtags("$AAPL $MSFT");
    expect(a).toEqual(b);
    expect(a).toEqual(["AAPL", "MSFT"]);
  });
});

describe("isValidSymbol", () => {
  it("接受常规美股代码", () => {
    for (const s of ["NVDA", "MU", "AAPL", "BRK.B", "BF-A"]) expect(isValidSymbol(s)).toBe(true);
  });
  it("接受 A股/港股数字代码", () => {
    for (const s of ["688017", "000001", "0700"].filter((x) => x.length >= 4)) expect(isValidSymbol(s)).toBe(true);
  });
  it("拒绝宏观/缩写伪代码", () => {
    for (const s of ["AI", "FED", "CPI", "ETF", "CEO", "USD", "Q3", "IPO"]) expect(isValidSymbol(s)).toBe(false);
  });
  it("拒绝像年份的 4 位数字", () => {
    for (const s of ["2024", "2025", "1999"]) expect(isValidSymbol(s)).toBe(false);
  });
  it("拒绝过长/非法形态", () => {
    for (const s of ["TOOLONGX", "ab", "12", "$$$"]) expect(isValidSymbol(s)).toBe(false);
  });
  it("黑名单含常见误判词", () => {
    expect(NOT_TICKERS.has("AI")).toBe(true);
    expect(NOT_TICKERS.has("NVDA")).toBe(false);
  });
});
