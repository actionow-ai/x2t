import OpenAI from "openai";
import type { LlmProvider } from "./types";

// OpenAI 兼容适配器：换 baseURL/model/key 即可对接 OpenAI 官方、DeepSeek 等。
// 用 response_format: json_object（OpenAI 与 DeepSeek 都支持）保证可解析输出。
export function createOpenAiCompatible(cfg: {
  apiKey: string;
  baseURL?: string;
  model: string;
}): LlmProvider {
  const client = new OpenAI({
    apiKey: cfg.apiKey,
    baseURL: cfg.baseURL,
    timeout: Number(process.env.LLM_TIMEOUT_MS ?? 120_000), // 单次调用超时(默认 2min:容纳推理模型并发下变慢),防 worker 被卡死请求拖住
    maxRetries: 1,
  });

  return {
    name: `openai-compatible:${cfg.model}`,
    async completeJson(system: string, user: string): Promise<string> {
      const res = await client.chat.completions.create({
        model: cfg.model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
        max_tokens: Number(process.env.LLM_MAX_TOKENS ?? 4000), // 输出封顶,防异常长输出烧 token
      });
      return res.choices[0]?.message?.content ?? "";
    },
  };
}
