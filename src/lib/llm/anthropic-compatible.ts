import Anthropic from "@anthropic-ai/sdk";
import type { LlmProvider } from "./types";

// Anthropic Messages API 适配器(对接 Claude 官方 / 兼容中转的 /claude 端点)。
// 与 OpenAI 兼容适配器并列:格式不同(system 顶层参数、无 temperature/response_format、max_tokens 必填)。
// 注:Opus 4.x 不接受 temperature(会 400);adaptive thinking 默认关(不传即关,快)。

// Opus 常把 JSON 包在 ```json … ``` 代码块里,剥掉围栏再交给调用方 JSON.parse。
function stripFence(s: string): string {
  const t = s.trim();
  const m = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return (m ? m[1] : t).trim();
}

export function createAnthropicCompatible(cfg: { apiKey: string; baseURL?: string; model: string }): LlmProvider {
  const client = new Anthropic({
    apiKey: cfg.apiKey,
    baseURL: cfg.baseURL,
    timeout: Number(process.env.LLM_TIMEOUT_MS ?? 60_000), // 单次调用超时,防 worker 被卡死请求拖住
    maxRetries: 1,
  });

  return {
    name: `anthropic:${cfg.model}`,
    async completeJson(system: string, user: string): Promise<string> {
      const res = await client.messages.create({
        model: cfg.model,
        max_tokens: Number(process.env.LLM_MAX_TOKENS ?? 4000),
        system,
        messages: [{ role: "user", content: user }],
      });
      const text = res.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");
      return stripFence(text);
    },
  };
}
