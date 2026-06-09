import Link from "next/link";
import { CashtagText } from "./CashtagText";
import { StanceBadge, TickerBadge, stanceText } from "./StanceBadge";
import { AvatarInner } from "./Avatar";
import { Reactions } from "./Reactions";
import { relativeTime } from "@/lib/time";
import { getDict, type Locale } from "@/lib/i18n";

type PostCardData = {
  id: string;
  contentText: string;
  contentZh?: string | null;
  contentEn?: string | null;
  lang?: string | null;
  url: string | null;
  postedAt: Date;
  influencer: { handle: string; displayName: string | null; avatarUrl: string | null };
  analysis?: { summary: string; summaryEn?: string | null; overallStance: string } | null;
  tickers?: { symbol: string; stance: string }[];
  likeCount?: number;
  dislikeCount?: number;
  myVote?: number;
};

export function PostCard({ post, selected, locale = "zh" }: { post: PostCardData; selected?: boolean; locale?: Locale }) {
  const inf = post.influencer;
  const name = inf.displayName ?? inf.handle;
  const t = getDict(locale);
  const en = locale === "en";
  const content = (en ? post.contentEn : post.contentZh) || post.contentText;
  const summary = post.analysis ? (en && post.analysis.summaryEn ? post.analysis.summaryEn : post.analysis.summary) : "";

  return (
    <article className="post-card" data-stance={post.analysis?.overallStance} data-selected={selected ? "" : undefined}>
      <div className="pc-top">
        <Link href={`/i/${inf.handle}`} className="pc-av">
          <AvatarInner src={inf.avatarUrl} name={name} />
        </Link>
        <div>
          <Link href={`/i/${inf.handle}`}>
            <div className="pc-name">{name}</div>
          </Link>
          <div className="pc-handle">@{inf.handle}</div>
        </div>
        <Link href={`/p/${post.id}`} className="pc-time">
          {relativeTime(post.postedAt, locale)}
        </Link>
      </div>

      <Link href={`/p/${post.id}`}>
        <div className="pc-text pc-text--clamp">
          <CashtagText text={content} />
        </div>
      </Link>

      {post.analysis && (
        <div className="ai-box">
          <div className="ai-label">{t.post.ai}</div>
          <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap", marginBottom: "0.4rem" }}>
            <StanceBadge stance={post.analysis.overallStance} locale={locale} label={`${t.stance.overallPrefix}${stanceText(post.analysis.overallStance, locale)}`} />
            {post.tickers?.map((tk) => (
              <TickerBadge key={tk.symbol} symbol={tk.symbol} stance={tk.stance} />
            ))}
          </div>
          <div style={{ fontSize: "0.85rem" }}>{summary}</div>
        </div>
      )}

      <div className="pc-src">
        {post.url && (
          <a href={post.url} target="_blank" rel="noreferrer">{t.common.originalPost} ↗</a>
        )}
        <span>{t.common.notFinancialAdvice}</span>
      </div>

      <Reactions
        postId={post.id}
        likes={post.likeCount ?? 0}
        dislikes={post.dislikeCount ?? 0}
        myVote={post.myVote ?? 0}
        share={{
          brandLine: `${name}${post.tickers?.[0] ? ` · $${post.tickers[0].symbol}` : ""}`,
          headline: summary ? summary.slice(0, 56) : post.tickers?.[0] ? `$${post.tickers[0].symbol}` : name,
          sub: post.analysis ? `${t.stance.overallPrefix}${stanceText(post.analysis.overallStance, locale)}` : undefined,
          accent: post.analysis?.overallStance === "bullish" ? "bull" : post.analysis?.overallStance === "bearish" ? "bear" : "neutral",
          tweetText: `${name}${post.tickers?.[0] ? ` 对 $${post.tickers[0].symbol}` : ""}${post.analysis ? `: ${stanceText(post.analysis.overallStance, locale)}` : ""}${summary ? ` — ${summary.slice(0, 80)}` : ""}`,
          url: `/p/${post.id}`,
        }}
      />
    </article>
  );
}
