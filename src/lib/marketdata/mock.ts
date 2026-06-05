import type { MarketDataProvider, ExternalData } from "./types";

// 无 key 时的 mock：按 symbol 确定性生成数据，便于无 key 端到端验证。
function seed(symbol: string): number {
  let h = 0;
  for (let i = 0; i < symbol.length; i++) h = (h * 31 + symbol.charCodeAt(i)) % 100000;
  return h;
}

export function createMockMarketData(): MarketDataProvider {
  return {
    name: "mock",
    async getExternalData(symbol: string): Promise<ExternalData> {
      const s = seed(symbol);
      const price = 20 + (s % 900);
      const changePct = (s % 800) / 100 - 4; // -4 .. +4
      return {
        quote: { price: Number(price.toFixed(2)), changePct: Number(changePct.toFixed(2)) },
        profile: { name: `${symbol} (mock)`, exchange: "MOCK", sector: "—" },
        news: [{ headline: `（mock 新闻）${symbol} 相关动态占位` }],
      };
    },
  };
}
