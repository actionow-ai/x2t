import type { LlmProvider } from "./types";
import { createOpenAiCompatible } from "./openai-compatible";
import { createMockLlm } from "./mock";

// 选择 LLM provider：有 LLM_API_KEY → OpenAI 兼容（OpenAI/DeepSeek/…），否则 mock。
export function getLlmProvider(): LlmProvider {
  const apiKey = process.env.LLM_API_KEY;
  if (apiKey) {
    return createOpenAiCompatible({
      apiKey,
      baseURL: process.env.LLM_BASE_URL || undefined,
      model: process.env.LLM_MODEL || "gpt-4o-mini",
    });
  }
  return createMockLlm();
}

export type { LlmProvider } from "./types";
