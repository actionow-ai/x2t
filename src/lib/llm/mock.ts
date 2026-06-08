import type { LlmProvider } from "./types";

// 无 key 时的 mock：基于关键词的确定性"分析"，让分析管道无 key 也能端到端跑通。
// 接入真实 LLM（OpenAI/DeepSeek）后自动替换。
export function createMockLlm(): LlmProvider {
  return {
    name: "mock",
    async completeJson(_system: string, user: string): Promise<string> {
      const cashtags = Array.from(
        new Set((user.match(/\$[A-Za-z]{1,6}/g) ?? []).map((s) => s.slice(1).toUpperCase())),
      );
      const bullish = /(buy|long|bull|breakout|target|看多|加仓|看涨|做多)/i.test(user);
      const bearish = /(sell|short|bear|put|dump|看空|减仓|看跌|做空)/i.test(user);
      const overall = bullish && !bearish ? "bullish" : bearish && !bullish ? "bearish" : "neutral";

      const tickers = (cashtags.length ? cashtags : []).map((symbol) => ({
        symbol,
        stance: overall,
        rationale: "（mock：基于关键词的占位分析）",
      }));

      const zh = overall === "bullish" ? "偏多" : overall === "bearish" ? "偏空" : "中性";
      const syms = tickers.map((t) => t.symbol).join(", ");
      // mock 默认按中文输出（lang=zh）；翻译由 flash 层完成（无 key 时回退原文）。
      return JSON.stringify({
        lang: "zh",
        overallStance: overall,
        confidence: 0.5,
        summary: `（mock 分析）整体${zh}${tickers.length ? `，涉及 ${syms}` : ""}。接入真实 LLM 后此处为模型摘要。`,
        keyPoints: ["mock 要点：填入 LLM_API_KEY 后由模型抽取真实要点"],
        tickers,
      });
    },
  };
}
