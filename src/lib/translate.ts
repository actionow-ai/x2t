import { buildTranslateProvider, parseEndpoints } from "./llm/config";

// flash 翻译层：把帖子内容 + 分析翻成【单个目标语种】。
// 原语种槽由 agent 原文直接填充,故只需翻"缺失"的那一两种语言,省一半翻译 token。
// 走与分析同一条多 provider 兜底链,但各端点取自己的 TRANSLATE_MODEL（缺省回退到该端点的 LLM_MODEL）。

export type TranslateInput = {
  content: string;
  summary: string;
  keyPoints: string[];
  tickers: { symbol: string; rationale?: string }[];
};

export type TranslateOutput = {
  content: string;
  summary: string;
  keyPoints: string[];
  rationales: Record<string, string>; // symbol -> 目标语种 rationale
};

function flashProvider() {
  return buildTranslateProvider(); // 无端点 → null（调用方回退原文）
}

export function translateConfigured(): boolean {
  return parseEndpoints().length > 0;
}

const LANG_NAME: Record<"zh" | "en", string> = { zh: "简体中文", en: "英文" };

// 译文质检兜底:空/异常短(疑似被截断或漏译)→ 回退原文,避免出现半截没翻的内容。
function safe(translated: unknown, original: string): string {
  if (typeof translated !== "string" || !translated.trim()) return original;
  if (original.length > 20 && translated.length < original.length * 0.25) return original;
  return translated;
}

// 翻成单一目标语种;任何异常/解析失败 → 返回 null,调用方回退原文。
export async function translateTo(input: TranslateInput, target: "zh" | "en"): Promise<TranslateOutput | null> {
  const flash = flashProvider();
  if (!flash) return null;

  const system =
    `你是翻译引擎。把给定 JSON 中所有文本字段翻译成【${LANG_NAME[target]}】,` +
    "保留 $股票代码、数字、专有名词与品牌名不译。只输出一个 JSON 对象,结构严格为:" +
    '{"content":"","summary":"","keyPoints":[],"tickers":[{"symbol":"","rationale":""}]}';
  const user = JSON.stringify(input);

  try {
    const raw = await flash.completeJson(system, user);
    const p = JSON.parse(raw);
    const rationales: Record<string, string> = {};
    for (const t of Array.isArray(p.tickers) ? p.tickers : []) {
      if (t?.symbol) rationales[String(t.symbol).toUpperCase()] = typeof t.rationale === "string" ? t.rationale : "";
    }
    return {
      content: safe(p.content, input.content),
      summary: safe(p.summary, input.summary),
      keyPoints: Array.isArray(p.keyPoints) ? p.keyPoints.map((x: unknown) => String(x)) : input.keyPoints,
      rationales,
    };
  } catch (e) {
    console.error(`[translate→${target}] 失败:`, e instanceof Error ? e.message : e);
    return null;
  }
}
