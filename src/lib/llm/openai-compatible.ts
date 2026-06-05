import OpenAI from "openai";
import type { LlmProvider } from "./types";

// OpenAI 兼容适配器：换 baseURL/model/key 即可对接 OpenAI 官方、DeepSeek 等。
// 用 response_format: json_object（OpenAI 与 DeepSeek 都支持）保证可解析输出。
export function createOpenAiCompatible(cfg: {
  apiKey: string;
  baseURL?: string;
  model: string;
}): LlmProvider {
  const client = new OpenAI({ apiKey: cfg.apiKey, baseURL: cfg.baseURL });

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
      });
      return res.choices[0]?.message?.content ?? "";
    },
  };
}
