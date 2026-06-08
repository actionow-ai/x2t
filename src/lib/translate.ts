import { createOpenAiCompatible } from "./llm/openai-compatible";

// flash 翻译层：把帖子内容 + 分析（原始语种）翻成简体中文(zh)与英文(en)两版。
// 用更便宜的 flash 模型（TRANSLATE_MODEL，默认 deepseek-v4-flash）做全局翻译，与做分析的 agent 模型解耦。

export type TranslateInput = {
  lang: string;
  content: string;
  summary: string;
  keyPoints: string[];
  tickers: { symbol: string; rationale?: string }[];
};

export type TranslateResult = {
  contentZh: string;
  contentEn: string;
  summaryZh: string;
  summaryEn: string;
  keyPointsZh: string[];
  keyPointsEn: string[];
  rationales: Record<string, { zh: string; en: string }>; // by symbol
};

function flashProvider() {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) return null; // 无 key → 不翻译（调用方回退原文）
  return createOpenAiCompatible({
    apiKey,
    baseURL: process.env.LLM_BASE_URL || undefined,
    model: process.env.TRANSLATE_MODEL || "deepseek-v4-flash",
  });
}

export function translateConfigured(): boolean {
  return !!process.env.LLM_API_KEY;
}

export async function translateBundle(input: TranslateInput): Promise<TranslateResult | null> {
  const flash = flashProvider();
  if (!flash) return null;

  const system =
    "你是翻译引擎。把给定 JSON 中的所有文本字段翻译成【简体中文 zh】与【英文 en】两版，" +
    "保留 $股票代码、数字、专有名词与品牌名不译。只输出一个 JSON 对象，结构严格为：" +
    '{"content":{"zh":"","en":""},"summary":{"zh":"","en":""},"keyPoints":{"zh":[],"en":[]},"tickers":[{"symbol":"","rationale":{"zh":"","en":""}}]}';
  const user = JSON.stringify(input);

  const raw = await flash.completeJson(system, user);
  const p = JSON.parse(raw);

  const rationales: Record<string, { zh: string; en: string }> = {};
  for (const t of p.tickers ?? []) {
    if (t?.symbol) rationales[String(t.symbol).toUpperCase()] = { zh: t.rationale?.zh ?? "", en: t.rationale?.en ?? "" };
  }

  return {
    contentZh: p.content?.zh || input.content,
    contentEn: p.content?.en || input.content,
    summaryZh: p.summary?.zh || input.summary,
    summaryEn: p.summary?.en || input.summary,
    keyPointsZh: Array.isArray(p.keyPoints?.zh) ? p.keyPoints.zh : input.keyPoints,
    keyPointsEn: Array.isArray(p.keyPoints?.en) ? p.keyPoints.en : input.keyPoints,
    rationales,
  };
}
