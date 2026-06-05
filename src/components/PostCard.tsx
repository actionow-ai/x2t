import Link from "next/link";
import { CashtagText } from "./CashtagText";
import { relativeTime } from "@/lib/time";

type PostCardData = {
  id: string;
  contentText: string;
  url: string | null;
  postedAt: Date;
  influencer: { handle: string; displayName: string | null; avatarUrl: string | null };
  analysis?: { summary: string; overallStance: string } | null;
};

export function PostCard({ post }: { post: PostCardData }) {
  const inf = post.influencer;
  const name = inf.displayName ?? inf.handle;

  return (
    <article className="post-card">
      <div className="pc-top">
        <Link href={`/i/${inf.handle}`} className="pc-av">
          {inf.avatarUrl ? <img src={inf.avatarUrl} alt={name} /> : "📈"}
        </Link>
        <div>
          <Link href={`/i/${inf.handle}`}>
            <div className="pc-name">{name}</div>
          </Link>
          <div className="pc-handle">@{inf.handle}</div>
        </div>
        <Link href={`/p/${post.id}`} className="pc-time">
          {relativeTime(post.postedAt)}
        </Link>
      </div>

      <Link href={`/p/${post.id}`}>
        <div className="pc-text">
          <CashtagText text={post.contentText} />
        </div>
      </Link>

      {post.analysis && (
        <div className="ai-box">
          <div className="ai-label">🤖 AI 分析</div>
          <div style={{ fontSize: "0.85rem" }}>{post.analysis.summary}</div>
        </div>
      )}

      <div className="pc-src">
        {post.url && (
          <a href={post.url} target="_blank" rel="noreferrer">原帖 ↗</a>
        )}
        <span>非投资建议</span>
      </div>
    </article>
  );
}
