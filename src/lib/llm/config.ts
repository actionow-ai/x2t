import type { LlmProvider } from "./types";
import { createOpenAiCompatible } from "./openai-compatible";

// 多 provider 顺序兜底链。
// 主端点 = 现有无后缀变量(LLM_API_KEY / LLM_BASE_URL / LLM_MODEL / TRANSLATE_MODEL,向后兼容);
// 兜底端点 = 同名 + _2 / _3 … 后缀(要求连续编号,断档即停)。
// 降级触发:provider 报错 / 超时 / 429 / 5xx / 空响应 → 顺延下一个端点(JSON 解析失败不在此层,由调用方重试兜)。
export type LlmEndpoint = {
  apiKey: string;
  baseURL?: string;
  model: string; // 分析模型(getLlmProvider 用)
  translateModel: string; // 翻译模型(translate 用;缺省回退到 model)
};

const DEFAULT_MODEL = "gpt-4o-mini";
const MAX_ENDPOINTS = 9;

// 解析有序端点列表:i=1 取无后缀变量,i≥2 取 _i 后缀;遇第一个缺 LLM_API_KEY 的号即停。
export function parseEndpoints(): LlmEndpoint[] {
  const out: LlmEndpoint[] = [];
  for (let i = 1; i <= MAX_ENDPOINTS; i++) {
    const s = i === 1 ? "" : `_${i}`;
    const apiKey = process.env[`LLM_API_KEY${s}`]?.trim();
    if (!apiKey) break;
    const model = process.env[`LLM_MODEL${s}`]?.trim() || DEFAULT_MODEL;
    out.push({
      apiKey,
      baseURL: process.env[`LLM_BASE_URL${s}`]?.trim() || undefined,
      model,
      translateModel: process.env[`TRANSLATE_MODEL${s}`]?.trim() || model,
    });
  }
  return out;
}

// 把多个 provider 包成顺序兜底链:首个"非空且不抛"即返回;每次降级 console.warn;全挂抛聚合错误。
// 单 provider 直接透传(不加包装,零开销)。
export function createFallback(providers: LlmProvider[]): LlmProvider {
  if (providers.length === 1) return providers[0];
  return {
    name: `fallback[${providers.map((p) => p.name).join(" → ")}]`,
    async completeJson(system, user) {
      const errs: string[] = [];
      for (let i = 0; i < providers.length; i++) {
        const p = providers[i];
        try {
          const out = await p.completeJson(system, user);
          if (out && out.trim()) {
            if (i > 0) console.warn(`[llm] 已降级至 ${p.name}(前 ${i} 个端点失败)`);
            return out;
          }
          errs.push(`${p.name}: 空响应`);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          errs.push(`${p.name}: ${msg}`);
          console.warn(`[llm] ${p.name} 失败,降级下一个:`, msg);
        }
      }
      throw new Error(`所有 LLM provider 失败 → ${errs.join(" | ")}`);
    },
  };
}

// 分析兜底链(各端点取 analysis model)。无端点 → null(调用方回退 mock)。
export function buildAnalysisProvider(): LlmProvider | null {
  const eps = parseEndpoints();
  if (!eps.length) return null;
  return createFallback(eps.map((e) => createOpenAiCompatible({ apiKey: e.apiKey, baseURL: e.baseURL, model: e.model })));
}

// 翻译兜底链(各端点取 translate model)。无端点 → null(调用方回退原文)。
export function buildTranslateProvider(): LlmProvider | null {
  const eps = parseEndpoints();
  if (!eps.length) return null;
  return createFallback(eps.map((e) => createOpenAiCompatible({ apiKey: e.apiKey, baseURL: e.baseURL, model: e.translateModel })));
}
