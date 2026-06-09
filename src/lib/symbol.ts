// 标的符号工具:cashtag 抽取 + 合法代码校验 + 伪代码黑名单。纯函数,无副作用,便于单测。

const CASHTAG_SRC = "\\$([A-Za-z]{1,6}(?:\\.[A-Za-z]{1,4})?)";

export function extractCashtags(text: string): string[] {
  const out = new Set<string>();
  const re = new RegExp(CASHTAG_SRC, "g"); // 每次新建,避免共享 lastIndex 的隐患
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) out.add(m[1].toUpperCase());
  return [...out];
}

// 常见"看着像代码、实则不是"的宏观/缩写词黑名单(LLM 偶尔会吐进 tickers[])。
// 注意:BTC/ETH/SOL 等加密代码是 3 字母真标的,不在此列。
export const NOT_TICKERS = new Set([
  "AI", "AGI", "LLM", "ML", "API", "UI", "UX", "CEO", "CFO", "CTO", "COO", "SEC", "FDA", "FTC", "DOJ", "IRS",
  "FED", "FOMC", "CPI", "PPI", "GDP", "PMI", "ISM", "EPS", "PE", "PEG", "ROE", "ROI", "ROIC", "EV", "IPO",
  "ETF", "ETN", "ESG", "EBITDA", "USA", "USD", "EUR", "GBP", "JPY", "CNY", "RMB", "YOY", "QOQ", "MOM",
  "ATH", "ATL", "WTI", "OPEC", "CES", "AGM", "FAQ", "Q1", "Q2", "Q3", "Q4", "H1", "H2", "FY", "TBD", "DD", "YOLO", "FOMO", "HODL",
]);

// 像合法代码才落库:1-6 字母(可带 .X/-X 后缀)或 4-6 位数字(A/港股);过滤黑名单词与年份号。
export function isValidSymbol(s: string): boolean {
  if (NOT_TICKERS.has(s)) return false;
  if (/^[A-Z]{1,6}([.-][A-Z]{1,4})?$/.test(s)) return true;
  if (/^[0-9]{4,6}$/.test(s)) {
    if (s.length === 4) {
      const n = Number(s);
      if (n >= 1990 && n <= 2099) return false; // 4 位且像年份 → 噪音,非代码
    }
    return true;
  }
  return false;
}
