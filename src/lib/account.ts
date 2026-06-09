// 账号类型区分(黑盒:把"媒体报道了什么"和"交易员押注什么"混进同一共识池,稀释了"共识"含义)。
// 已知"新闻/数据搬运号"——其立场多来自转述报道,而非本人持仓押注。用于在共识/博主页/列表里标注区分。
// 注:先用代码侧集合(零迁移、即时生效);来源多了可提升为 Influencer.kind 字段。
const NEWS_HANDLES = new Set(
  [
    "zerohedge",
    "DeItaone",
    "Walter Bloomberg",
    "StockMKTNewz",
    "marketwatch",
    "cnbc-markets",
    "cnbc",
    "unusual_whales",
    "Barchart",
    "FirstSquawk",
    "LiveSquawk",
    "financialjuice",
    "Reuters",
    "business",
    "markets",
  ].map((h) => h.toLowerCase()),
);

/** 是否为新闻/数据搬运号(立场多为转述、非本人押注)。 */
export function isNewsAccount(handle: string): boolean {
  return NEWS_HANDLES.has(handle.toLowerCase());
}
