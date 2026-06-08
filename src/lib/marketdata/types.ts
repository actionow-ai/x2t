// 可插拔外部数据 provider 接口 —— 设计文档 §4。Finnhub / mock / 可扩展。
export type Quote = { price: number; changePct: number };
export type Profile = { name?: string; exchange?: string; sector?: string; marketCap?: number };
export type NewsItem = { headline: string; url?: string };
// 新闻情绪(Alpha Vantage NEWS_SENTIMENT)：score ∈ [-1,1]，label 为 AV 五档文字。
export type Sentiment = { score: number; label: string; articleCount?: number; source?: string };
// 事件日历(FMP)：财报/分红/经济事件等。
export type MarketEvent = { type: string; date: string; title: string };

export type ExternalData = {
  quote?: Quote;
  profile?: Profile;
  news?: NewsItem[];
  sentiment?: Sentiment;
  events?: MarketEvent[];
};

export interface MarketDataProvider {
  readonly name: string;
  getExternalData(symbol: string): Promise<ExternalData>;
}
