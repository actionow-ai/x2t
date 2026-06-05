// 可插拔外部数据 provider 接口 —— 设计文档 §4。Finnhub / mock / 可扩展。
export type Quote = { price: number; changePct: number };
export type Profile = { name?: string; exchange?: string; sector?: string; marketCap?: number };
export type NewsItem = { headline: string; url?: string };

export type ExternalData = {
  quote?: Quote;
  profile?: Profile;
  news?: NewsItem[];
};

export interface MarketDataProvider {
  readonly name: string;
  getExternalData(symbol: string): Promise<ExternalData>;
}
