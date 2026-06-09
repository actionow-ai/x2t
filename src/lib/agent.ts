import { prisma } from "./db";
import { getLlmProvider } from "./llm";
import { getExternalDataCached } from "./marketdata";
import { analysisSchema } from "./agent-schema";
import { translateTo, type TranslateOutput } from "./translate";
import { detectFlips } from "./stance";
import { notifyFlip } from "./push";

const CASHTAG = /\$([A-Za-z]{1,6}(?:\.[A-Za-z]{1,4})?)/g;

function extractCashtags(text: string): string[] {
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = CASHTAG.exec(text)) !== null) out.add(m[1].toUpperCase());
  return [...out];
}

// 像合法代码才落库:1-6 字母(可带 .X/-X 后缀)或 4-6 位数字(A/港股)。过滤 LLM 杜撰的词。
function isValidSymbol(s: string): boolean {
  return /^[A-Z]{1,6}([.-][A-Z]{1,4})?$/.test(s) || /^[0-9]{4,6}$/.test(s);
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
      "标的抽取：除 candidateTickers 外，识别正文中以公司名/产品名/裸代码/中文名提及的标的，统一映射为规范交易代码" +
      "(美股用大写字母，A股/港股用数字代码)；只产出真实可交易标的，不要把 Fed/AI/财报/Q3 等普通词当代码。" +
      "结合 externalData(各标的实时报价 quote、近期新闻 news、公司概况 profile、新闻情绪 sentiment(-1~1)、事件日历 events(如临近财报))：" +
      "在 rationale 中点明博主观点与当前价格/消息面/市场情绪是一致还是背离、是否临近财报等事件；" +
      "若该标的无 externalData，标注「无外部数据佐证」，不要臆造行情。" +
      "置信度校准：证据充分才给高 confidence；信息不足/仅转发他人/纯提问 → overallStance=neutral 且 confidence 偏低。" +
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

    // 5. flash 翻译：只翻【缺失】语种(原语种槽用 agent 原文,省一半 token);两种缺失则并行。翻译失败回退原文。
    const trInput = {
      content: post.contentText,
      summary: parsed.summary,
      keyPoints: parsed.keyPoints,
      tickers: parsed.tickers.map((t) => ({ symbol: t.symbol.replace(/^\$/, "").toUpperCase(), rationale: t.rationale })),
    };
    const [trZh, trEn]: [TranslateOutput | null, TranslateOutput | null] = await Promise.all([
      isZh ? Promise.resolve(null) : translateTo(trInput, "zh"),
      isEn ? Promise.resolve(null) : translateTo(trInput, "en"),
    ]);
    const contentZh = isZh ? post.contentText : trZh?.content ?? post.contentText;
    const contentEn = isEn ? post.contentText : trEn?.content ?? post.contentText;
    const summaryZh = isZh ? parsed.summary : trZh?.summary ?? parsed.summary;
    const summaryEn = isEn ? parsed.summary : trEn?.summary ?? parsed.summary;
    const keyPointsZh = isZh ? parsed.keyPoints : trZh?.keyPoints ?? parsed.keyPoints;
    const keyPointsEn = isEn ? parsed.keyPoints : trEn?.keyPoints ?? parsed.keyPoints;

    // 6. 落库（事务）。summary=中文槽，summaryEn=英文槽；Post.lang/contentZh/contentEn 存原文与两版翻译
    await prisma.$transaction(async (tx) => {
      for (const t of parsed.tickers) {
        const symbol = t.symbol.replace(/^\$/, "").toUpperCase();
        if (!isValidSymbol(symbol)) continue; // 过滤 LLM 杜撰的非代码(Fed/AI 短词/Q3 等),防污染 Security 表与图谱
        const rz = isZh ? t.rationale : trZh?.rationales[symbol] || t.rationale;
        const re = isEn ? t.rationale : trEn?.rationales[symbol] || t.rationale;
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

// 当日已分析帖数(内存计数,重启归零的软成本闸)。ANALYZE_DAILY_CAP=0 表示不限。
let _budgetDay = "";
let _budgetCount = 0;

/** 批量处理 analysis_status=pending 的帖子（小并发池，吞吐↑；并发度 ANALYZE_CONCURRENCY，默认 3）。 */
export async function analyzePending(limit = 20): Promise<{ processed: number; ok: number }> {
  // 当日分析上限:防 backfill / 批量 reanalyze 烧爆 LLM 额度
  const cap = Number(process.env.ANALYZE_DAILY_CAP ?? 0);
  const today = new Date().toISOString().slice(0, 10);
  if (today !== _budgetDay) {
    _budgetDay = today;
    _budgetCount = 0;
  }
  if (cap > 0 && _budgetCount >= cap) {
    console.warn(`[agent] 已达当日分析上限 ${cap},暂停分析(ANALYZE_DAILY_CAP)`);
    return { processed: 0, ok: 0 };
  }
  const take = cap > 0 ? Math.min(limit, cap - _budgetCount) : limit;

  const pending = await prisma.post.findMany({
    where: { analysisStatus: "pending" },
    orderBy: { postedAt: "desc" },
    take,
  });
  _budgetCount += pending.length;
  const conc = Math.max(1, Math.min(8, Number(process.env.ANALYZE_CONCURRENCY ?? 3)));
  let ok = 0;
  let idx = 0;
  async function worker() {
    while (idx < pending.length) {
      const p = pending[idx++];
      const r = await analyzePost(p.id);
      if (r.ok) ok++;
    }
  }
  await Promise.all(Array.from({ length: Math.min(conc, pending.length) }, () => worker()));
  return { processed: pending.length, ok };
}
