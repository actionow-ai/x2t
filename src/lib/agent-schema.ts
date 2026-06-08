import { z } from "zod";

// Agent 分析的结构化输出 schema —— LLM 必须产出符合此结构的 JSON，否则重试。
// Agent 按帖子【原始语种】分析并输出，并标注 lang；双语由 flash 翻译层完成（见 translate.ts）。
export const stanceEnum = z.enum(["bullish", "bearish", "neutral"]);

export const analysisSchema = z.object({
  lang: z.string().min(2).max(8), // 帖子/分析的语种代码，如 en / zh / ja
  overallStance: stanceEnum,
  confidence: z.number().min(0).max(1),
  summary: z.string().min(1), // 用原始语种
  keyPoints: z.array(z.string()).default([]), // 用原始语种
  tickers: z
    .array(
      z.object({
        symbol: z.string().min(1),
        stance: stanceEnum,
        rationale: z.string().optional(), // 用原始语种
      }),
    )
    .default([]),
});

export type Analysis = z.infer<typeof analysisSchema>;
