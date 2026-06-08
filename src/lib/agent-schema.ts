import { z } from "zod";

// Agent 分析的结构化输出 schema —— LLM 必须产出符合此结构的 JSON，否则重试。
// 文本字段中英双语：xxx = 中文，xxxEn = English。
export const stanceEnum = z.enum(["bullish", "bearish", "neutral"]);

export const analysisSchema = z.object({
  overallStance: stanceEnum,
  confidence: z.number().min(0).max(1),
  summary: z.string().min(1), // 中文摘要
  summaryEn: z.string().min(1), // English summary
  keyPoints: z.array(z.string()).default([]), // 中文要点
  keyPointsEn: z.array(z.string()).default([]), // English key points
  tickers: z
    .array(
      z.object({
        symbol: z.string().min(1),
        stance: stanceEnum,
        rationale: z.string().optional(), // 中文理由
        rationaleEn: z.string().optional(), // English rationale
      }),
    )
    .default([]),
});

export type Analysis = z.infer<typeof analysisSchema>;
