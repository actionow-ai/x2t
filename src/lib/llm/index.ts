import type { LlmProvider } from "./types";
import { createMockLlm } from "./mock";
import { parseEndpoints, buildAnalysisProvider } from "./config";

// 是否配了真实 LLM(生产用于防 mock 占位分析以 done 永久污染数据)。
export function isLlmConfigured(): boolean {
  return parseEndpoints().length > 0;
}

// 选择 LLM provider：有端点 → 多 provider 顺序兜底链（OpenAI/DeepSeek/中转/…），否则 mock。
export function getLlmProvider(): LlmProvider {
  return buildAnalysisProvider() ?? createMockLlm();
}

export type { LlmProvider } from "./types";
