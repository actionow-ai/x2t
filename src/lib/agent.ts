import { prisma } from "./db";
import { getLlmProvider } from "./llm";
import { getExternalDataCached } from "./marketdata";
import { analysisSchema } from "./agent-schema";
import { translateBundle, type TranslateResult } from "./translate";
import { detectFlips } from "./stance";
import { notifyFlip } from "./push";

const CASHTAG = /\$([A-Za-z]{1,6})\b/g;

function extractCashtags(text: string): string[] {
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = CASHTAG.exec(text)) !== null) out.add(m[1].toUpperCase());
  return [...out];
}

/** 分析一条帖子：候选 ticker → 外部数据 → LLM 结构化分析 → 落库。失败标 failed。 */
export async function analyzePost(postId: string): Promise<{ ok: boolean; tickers: number }> {
  const post = await prisma.post.findUnique({ where: { id: postId }, include: { influencer: true } });
  if (!post) return { ok: false, tickers: 0 };

  try {
    // 1. cashtag 候选 → 2. 取（缓存的）外部数据
    const candidates = extractCashtags(post.contentText);
    const externalData: Record<string, unknown> = {};
    for (const sym of candidates) {
      externalData[sym] = await getExternalDataCached(sym);
    }

    // 3. LLM 结构化分析（按帖子【原始语种】输出，并标注 lang）
    const llm = getLlmProvider();
    const system =
      "你是金融信号分析助手。用【帖子的原始语种】分析并输出，对公开帖子与公开市场数据做客观摘要，不给买卖建议。" +
      "只输出一个 JSON 对象。字段：lang(帖子语种代码，如 en/zh/ja)、overallStance(bullish|bearish|neutral)、confidence(0..1 数字)、" +
      "summary(原始语种摘要)、keyPoints(原始语种要点数组)、tickers(数组，每项 {symbol, stance(bullish|bearish|neutral), rationale(原始语种理由)})。";
    const user = JSON.stringify({
      post: post.contentText,
      author: post.influencer.displayName ?? post.influencer.handle,
      candidateTickers: candidates,
      externalData,
    });

    // 4. 解析 + schema 校验（失败重试一次）
    let parsed;
    try {
      parsed = analysisSchema.parse(JSON.parse(await llm.completeJson(system, user)));
    } catch {
      const raw2 = await llm.completeJson(system + " 必须是严格合法的 JSON，且符合给定字段。", user);
      parsed = analysisSchema.parse(JSON.parse(raw2));
    }

    const lang = (parsed.lang || "en").toLowerCase().slice(0, 8);
    const isZh = lang.startsWith("zh");
    const isEn = lang.startsWith("en");

    // 5. flash 翻译：内容 + 分析 → 中/英（原语种槽用 agent 原文覆盖；翻译失败回退原文）
    let tr: TranslateResult | null = null;
    try {
      tr = await translateBundle({
        lang,
        content: post.contentText,
        summary: parsed.summary,
        keyPoints: parsed.keyPoints,
        tickers: parsed.tickers.map((t) => ({ symbol: t.symbol.replace(/^\$/, "").toUpperCase(), rationale: t.rationale })),
      });
    } catch (e) {
      console.error("[agent] 翻译失败:", e instanceof Error ? e.message : e);
    }
    const contentZh = isZh ? post.contentText : tr?.contentZh ?? post.contentText;
    const contentEn = isEn ? post.contentText : tr?.contentEn ?? post.contentText;
    const summaryZh = isZh ? parsed.summary : tr?.summaryZh ?? parsed.summary;
    const summaryEn = isEn ? parsed.summary : tr?.summaryEn ?? parsed.summary;
    const keyPointsZh = isZh ? parsed.keyPoints : tr?.keyPointsZh ?? parsed.keyPoints;
    const keyPointsEn = isEn ? parsed.keyPoints : tr?.keyPointsEn ?? parsed.keyPoints;

    // 6. 落库（事务）。summary=中文槽，summaryEn=英文槽；Post.lang/contentZh/contentEn 存原文与两版翻译
    await prisma.$transaction(async (tx) => {
      for (const t of parsed.tickers) {
        const symbol = t.symbol.replace(/^\$/, "").toUpperCase();
        if (!symbol) continue;
        const rz = isZh ? t.rationale : tr?.rationales[symbol]?.zh || t.rationale;
        const re = isEn ? t.rationale : tr?.rationales[symbol]?.en || t.rationale;
        await tx.security.upsert({ where: { symbol }, create: { symbol }, update: {} });
        await tx.postTicker.upsert({
          where: { postId_symbol: { postId: post.id, symbol } },
          create: { postId: post.id, symbol, stance: t.stance, rationale: rz, rationaleEn: re },
          update: { stance: t.stance, rationale: rz, rationaleEn: re },
        });
      }
      await tx.postAnalysis.upsert({
        where: { postId: post.id },
        create: { postId: post.id, lang, summary: summaryZh, summaryEn, keyPoints: keyPointsZh, keyPointsEn, overallStance: parsed.overallStance, confidence: parsed.confidence, model: llm.name },
        update: { lang, summary: summaryZh, summaryEn, keyPoints: keyPointsZh, keyPointsEn, overallStance: parsed.overallStance, confidence: parsed.confidence, model: llm.name },
      });
      await tx.post.update({ where: { id: post.id }, data: { lang, contentZh, contentEn, analysisStatus: "done" } });
    });

    // 转向检测 → 「立场转向」推送（失败不影响分析）
    try {
      const flips = await detectFlips(post.id);
      if (flips.length) await notifyFlip(post.id, flips);
    } catch (err) {
      console.error("[agent] 转向通知失败:", err instanceof Error ? err.message : err);
    }

    return { ok: true, tickers: parsed.tickers.length };
  } catch (err) {
    console.error(`[agent] post ${postId} 分析失败:`, err instanceof Error ? err.message : err);
    await prisma.post.update({ where: { id: postId }, data: { analysisStatus: "failed" } }).catch(() => {});
    return { ok: false, tickers: 0 };
  }
}

/** 批量处理 analysis_status=pending 的帖子。 */
export async function analyzePending(limit = 20): Promise<{ processed: number; ok: number }> {
  const pending = await prisma.post.findMany({
    where: { analysisStatus: "pending" },
    orderBy: { postedAt: "desc" },
    take: limit,
  });
  let ok = 0;
  for (const p of pending) {
    const r = await analyzePost(p.id);
    if (r.ok) ok++;
  }
  return { processed: pending.length, ok };
}
