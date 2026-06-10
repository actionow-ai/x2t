import { prisma } from "./db";
import { getInfluencerCalibration, type Calibration } from "./stance";

// 竞品借鉴(TradingAgents/FinMem 的"结算→反思→回灌"):把博主历史校准压成几个"信念" code,
// 既注入下一次 AI 分析的 system prompt(校准 confidence,欠费充值后生效),又在博主页展示。
export const BELIEF_CODES = ["recency_weak", "recency_strong", "short_term", "mid_term", "poor_calibration"] as const;
export type BeliefCode = (typeof BELIEF_CODES)[number];

// 纯函数(可单测):从校准度推出至多 2 条最显著的信念 code。样本不足/无近期加权 → 空。
export function buildBelief(cal: Calibration | null): BeliefCode[] {
  if (!cal || cal.recencyWeightedRate == null) return [];
  const codes: BeliefCode[] = [];
  if (cal.recencyWeightedRate < 0.45) codes.push("recency_weak");
  else if (cal.recencyWeightedRate > 0.6) codes.push("recency_strong");
  if (cal.h5Rate != null && cal.h20Rate != null) {
    if (cal.h5Rate - cal.h20Rate > 0.1) codes.push("short_term");
    else if (cal.h20Rate - cal.h5Rate > 0.1) codes.push("mid_term");
  }
  if (cal.brier != null && cal.brier > 0.3) codes.push("poor_calibration");
  return codes.slice(0, 2);
}

// 注入分析 prompt 的中文片段(用 zh,模型可理解;分析仍按帖子原语种输出)。
const BELIEF_ZH: Record<BeliefCode, string> = {
  recency_weak: "近期判断跑输大盘",
  recency_strong: "近期判断稳定跑赢大盘",
  short_term: "判断偏短线(5 日命中高于 20 日)",
  mid_term: "判断偏中线(20 日命中高于 5 日)",
  poor_calibration: "高置信度时未必更准(校准偏差大)",
};
export function beliefPromptClause(codes: BeliefCode[]): string {
  return codes.map((c) => BELIEF_ZH[c]).join("、");
}
// 从存储的逗号分隔串(Influencer.belief)还原 prompt 片段;非法 code 忽略。
export function beliefClauseFromStored(belief: string | null | undefined): string {
  if (!belief) return "";
  const codes = belief.split(",").filter((c): c is BeliefCode => (BELIEF_CODES as readonly string[]).includes(c));
  return beliefPromptClause(codes);
}

// worker 日度刷新:对每个未退出的博主算校准度 → 信念 code → 落库。失败单点跳过不拖垮整批。
export async function refreshAllBeliefs(): Promise<{ updated: number; withBelief: number }> {
  const infs = await prisma.influencer.findMany({ where: { optedOut: false }, select: { id: true } });
  let updated = 0;
  let withBelief = 0;
  for (const inf of infs) {
    try {
      const cal = await getInfluencerCalibration(inf.id);
      const codes = buildBelief(cal);
      await prisma.influencer.update({ where: { id: inf.id }, data: { belief: codes.length ? codes.join(",") : null, beliefAt: new Date() } });
      updated++;
      if (codes.length) withBelief++;
    } catch (e) {
      console.error("[belief] refresh 失败", inf.id, e instanceof Error ? e.message : e);
    }
  }
  return { updated, withBelief };
}
