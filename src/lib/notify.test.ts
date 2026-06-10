import { describe, it, expect } from "vitest";
import { stanceText, pickLocale, notify } from "./notify-format";

describe("notify-format 双语", () => {
  it("stanceText 中英 + 未知值回退原串", () => {
    expect(stanceText("bullish", "zh")).toBe("看多");
    expect(stanceText("bearish", "en")).toBe("Bearish");
    expect(stanceText("weird", "zh")).toBe("weird");
  });
  it("pickLocale:仅 en 为 en,其余(含 null/undefined)为 zh", () => {
    expect(pickLocale("en")).toBe("en");
    expect(pickLocale("zh")).toBe("zh");
    expect(pickLocale(null)).toBe("zh");
    expect(pickLocale(undefined)).toBe("zh");
  });
  it("flipLine:几何箭头 + 本地化立场", () => {
    expect(notify.flipLine("zh", "NVDA", "bearish", "bullish")).toBe("$NVDA 看空→看多");
    expect(notify.flipLine("en", "NVDA", "bearish", "bullish")).toBe("$NVDA Bearish→Bullish");
  });
});
