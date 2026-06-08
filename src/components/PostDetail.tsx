import { prisma } from "@/lib/db";
import type { ExternalData } from "@/lib/marketdata";
import { CashtagText } from "./CashtagText";
import { StanceBadge, stanceText } from "./StanceBadge";
import { formatDateTime } from "@/lib/time";
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

export function PostDetail({ post, dataBySymbol }: Detail) {
  const inf = post.influencer;
  const name = inf.displayName ?? inf.handle;
  const keyPoints = (post.analysis?.keyPoints as string[] | undefined) ?? [];

  return (
    <article className="post-card">
      <div className="pc-top">
        <Link href={`/i/${inf.handle}`} className="pc-av">{name.slice(0, 1).toUpperCase()}</Link>
        <div>
          <Link href={`/i/${inf.handle}`}>
            <div className="pc-name">{name}</div>
          </Link>
          <div className="pc-handle">@{inf.handle} · {formatDateTime(post.postedAt)}</div>
        </div>
      </div>

      <div className="pc-text">
        <CashtagText text={post.contentText} />
      </div>
      <div className="pc-src">
        {post.url && <a href={post.url} target="_blank" rel="noreferrer">查看原帖 ↗</a>}
        <span>非投资建议</span>
      </div>

      {post.analysis ? (
        <div className="ai-box">
          <div className="ai-label">AI 分析</div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
            <StanceBadge stance={post.analysis.overallStance} label={`整体${stanceText(post.analysis.overallStance)}`} />
            {typeof post.analysis.confidence === "number" && (
              <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>
                置信度 {Math.round(post.analysis.confidence * 100)}%
              </span>
            )}
            {post.analysis.model && (
              <span style={{ fontSize: "0.66rem", color: "var(--text-tertiary)", marginLeft: "auto" }}>{post.analysis.model}</span>
            )}
          </div>

          <div style={{ fontSize: "0.86rem", lineHeight: 1.5, marginBottom: "0.6rem" }}>{post.analysis.summary}</div>

          {post.tickers.length > 0 && (
            <>
              <div className="label-sm">涉及标的（{post.tickers.length}）</div>
              {post.tickers.map((t) => {
                const ext = dataBySymbol.get(t.symbol);
                return (
                  <div key={t.symbol} className="tcard">
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.3rem" }}>
                      <StanceBadge stance={t.stance} />
                      <strong>${t.symbol}</strong>
                      {ext?.profile?.name && (
                        <span style={{ fontSize: "0.7rem", color: "var(--text-tertiary)", marginLeft: "auto" }}>{ext.profile.name}</span>
                      )}
                    </div>
                    {t.rationale && <div style={{ fontSize: "0.78rem", marginBottom: "0.3rem" }}>{t.rationale}</div>}
                    {ext?.quote && (
                      <div className="ext-line">
                        行情 ${ext.quote.price}{" "}
                        <span className={ext.quote.changePct >= 0 ? "up" : "dn"}>
                          {ext.quote.changePct >= 0 ? "▲" : "▼"}
                          {Math.abs(ext.quote.changePct)}%
                        </span>
                      </div>
                    )}
                    {ext?.news && ext.news.length > 0 && (
                      <div className="ext-line">新闻 {ext.news.slice(0, 2).map((n) => n.headline).join(" · ")}</div>
                    )}
                  </div>
                );
              })}
            </>
          )}

          {keyPoints.length > 0 && (
            <>
              <div className="label-sm">关键要点</div>
              <ul style={{ margin: "0 0 0.3rem 1.1rem" }}>
                {keyPoints.map((k, i) => (
                  <li key={i} style={{ fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>{k}</li>
                ))}
              </ul>
            </>
          )}

          <div style={{ fontSize: "0.7rem", color: "var(--text-tertiary)", marginTop: "0.5rem" }}>
            对公开帖子与公开市场数据的客观摘要，非投资建议；数据可能延迟。
          </div>
        </div>
      ) : (
        <div className="ai-box">
          <div className="ai-label">AI 分析</div>
          <div style={{ color: "var(--text-tertiary)", fontSize: "0.82rem" }}>
            {post.analysisStatus === "failed" ? "分析失败，稍后重试。" : "分析处理中…（运行 pnpm analyze:once）"}
          </div>
        </div>
      )}
    </article>
  );
}
