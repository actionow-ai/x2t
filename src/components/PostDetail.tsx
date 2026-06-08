import { prisma } from "@/lib/db";
import type { ExternalData } from "@/lib/marketdata";
import { CashtagText } from "./CashtagText";
import { StanceBadge, stanceText } from "./StanceBadge";
import { AvatarInner } from "./Avatar";
import { formatDateTime } from "@/lib/time";
import { getDict, type Locale } from "@/lib/i18n";
import Link from "next/link";

// 取一条帖子的完整详情数据（post + 每只票的外部数据缓存）。供整页详情 + 双栏右侧共用。
export async function getPostDetail(id: string) {
  const post = await prisma.post.findUnique({
    where: { id },
    include: { influencer: true, analysis: true, tickers: { include: { security: true } } },
  });
  if (!post) return null;

  const symbols = post.tickers.map((t) => t.symbol);
  const caches = symbols.length
    ? await prisma.externalDataCache.findMany({
        where: { symbol: { in: symbols }, dataType: "bundle" },
        orderBy: { fetchedAt: "desc" },
      })
    : [];
  const dataBySymbol = new Map<string, ExternalData>();
  for (const c of caches) if (!dataBySymbol.has(c.symbol)) dataBySymbol.set(c.symbol, c.payload as ExternalData);

  return { post, dataBySymbol };
}

type Detail = NonNullable<Awaited<ReturnType<typeof getPostDetail>>>;

export function PostDetail({ post, dataBySymbol, locale = "zh" }: Detail & { locale?: Locale }) {
  const inf = post.influencer;
  const name = inf.displayName ?? inf.handle;
  const t = getDict(locale);
  const en = locale === "en";
  const kpRaw = en && post.analysis?.keyPointsEn ? post.analysis.keyPointsEn : post.analysis?.keyPoints;
  const keyPoints = (kpRaw as string[] | undefined) ?? [];
  const summary = post.analysis ? (en && post.analysis.summaryEn ? post.analysis.summaryEn : post.analysis.summary) : "";
  const content = (en ? post.contentEn : post.contentZh) || post.contentText;
  const isTranslated = !!post.lang && (en ? !post.lang.startsWith("en") : !post.lang.startsWith("zh")) && post.contentText !== content;

  return (
    <article className="post-card">
      <div className="pc-top">
        <Link href={`/i/${inf.handle}`} className="pc-av"><AvatarInner src={inf.avatarUrl} name={name} /></Link>
        <div>
          <Link href={`/i/${inf.handle}`}>
            <div className="pc-name">{name}</div>
          </Link>
          <div className="pc-handle">@{inf.handle} · {formatDateTime(post.postedAt)}</div>
        </div>
      </div>

      <div className="pc-text">
        <CashtagText text={content} />
      </div>
      {isTranslated && (
        <details className="orig-text">
          <summary>{t.post.original}{post.lang ? ` · ${post.lang.toUpperCase()}` : ""}</summary>
          <div className="pc-text" style={{ marginTop: "0.4rem", opacity: 0.8 }}><CashtagText text={post.contentText} /></div>
        </details>
      )}
      <div className="pc-src">
        {post.url && <a href={post.url} target="_blank" rel="noreferrer">{t.common.originalPost} ↗</a>}
        <span>{t.common.notFinancialAdvice}</span>
      </div>

      {post.analysis ? (
        <div className="ai-box">
          <div className="ai-label">{t.post.ai}</div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
            <StanceBadge stance={post.analysis.overallStance} locale={locale} label={`${t.stance.overallPrefix}${stanceText(post.analysis.overallStance, locale)}`} />
            {typeof post.analysis.confidence === "number" && (
              <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>
                {t.post.confidence} {Math.round(post.analysis.confidence * 100)}%
              </span>
            )}
            {post.analysis.model && (
              <span style={{ fontSize: "0.66rem", color: "var(--text-tertiary)", marginLeft: "auto" }}>{post.analysis.model}</span>
            )}
          </div>

          <div style={{ fontSize: "0.86rem", lineHeight: 1.5, marginBottom: "0.6rem" }}>{summary}</div>

          {post.tickers.length > 0 && (
            <>
              <div className="label-sm">{t.post.tickers}（{post.tickers.length}）</div>
              {post.tickers.map((tk) => {
                const ext = dataBySymbol.get(tk.symbol);
                return (
                  <div key={tk.symbol} className="tcard">
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.3rem" }}>
                      <StanceBadge stance={tk.stance} locale={locale} />
                      <strong>${tk.symbol}</strong>
                      {ext?.profile?.name && (
                        <span style={{ fontSize: "0.7rem", color: "var(--text-tertiary)", marginLeft: "auto" }}>{ext.profile.name}</span>
                      )}
                    </div>
                    {(en && tk.rationaleEn ? tk.rationaleEn : tk.rationale) && (
                      <div style={{ fontSize: "0.78rem", marginBottom: "0.3rem" }}>{en && tk.rationaleEn ? tk.rationaleEn : tk.rationale}</div>
                    )}
                    {ext?.quote && (
                      <div className="ext-line">
                        {t.post.quote} ${ext.quote.price}{" "}
                        <span className={ext.quote.changePct >= 0 ? "up" : "dn"}>
                          {ext.quote.changePct >= 0 ? "▲" : "▼"}
                          {Math.abs(ext.quote.changePct)}%
                        </span>
                      </div>
                    )}
                    {ext?.news && ext.news.length > 0 && (
                      <div className="ext-line">{t.post.news} {ext.news.slice(0, 2).map((n) => n.headline).join(" · ")}</div>
                    )}
                    {ext?.sentiment && typeof ext.sentiment.score === "number" && (
                      <div className="ext-line">
                        {t.post.sentiment}{" "}
                        <span className={ext.sentiment.score >= 0 ? "up" : "dn"}>
                          {ext.sentiment.label} ({ext.sentiment.score >= 0 ? "+" : ""}{ext.sentiment.score})
                        </span>
                      </div>
                    )}
                    {ext?.events && ext.events.length > 0 && (
                      <div className="ext-line">{t.post.events} {ext.events.map((e) => `${e.title} · ${e.date}`).join(" · ")}</div>
                    )}
                  </div>
                );
              })}
            </>
          )}

          {keyPoints.length > 0 && (
            <>
              <div className="label-sm">{t.post.keyPoints}</div>
              <ul style={{ margin: "0 0 0.3rem 1.1rem" }}>
                {keyPoints.map((k, i) => (
                  <li key={i} style={{ fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>{k}</li>
                ))}
              </ul>
            </>
          )}

          <div style={{ fontSize: "0.7rem", color: "var(--text-tertiary)", marginTop: "0.5rem" }}>
            {t.post.disclaimer}
          </div>
        </div>
      ) : (
        <div className="ai-box">
          <div className="ai-label">{t.post.ai}</div>
          <div style={{ color: "var(--text-tertiary)", fontSize: "0.82rem" }}>
            {post.analysisStatus === "failed" ? t.post.failedHint : t.post.analyzingHint}
          </div>
        </div>
      )}
    </article>
  );
}
