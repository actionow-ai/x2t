import { z } from "zod";

// Agent 分析的结构化输出 schema —— LLM 必须产出符合此结构的 JSON，否则重试。
export const stanceEnum = z.enum(["bullish", "bearish", "neutral"]);

export const analysisSchema = z.object({
  overallStance: stanceEnum,
  confidence: z.number().min(0).max(1),
  summary: z.string().min(1),
  keyPoints: z.array(z.string()).default([]),
  tickers: z
    .array(
      z.object({
        symbol: z.string().min(1),
        stance: stanceEnum,
        rationale: z.string().optional(),
      }),
    )
    .default([]),
});

export type Analysis = z.infer<typeof analysisSchema>;
