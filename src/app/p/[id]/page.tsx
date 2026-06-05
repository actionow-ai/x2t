import { prisma } from "@/lib/db";
import { CashtagText } from "@/components/CashtagText";
import { formatDateTime } from "@/lib/time";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const post = await prisma.post.findUnique({
    where: { id },
    include: { influencer: true, analysis: true, tickers: true },
  });
  if (!post) notFound();

  const inf = post.influencer;
  const name = inf.displayName ?? inf.handle;

  return (
    <article className="post-card">
      <div className="pc-top">
        <Link href={`/i/${inf.handle}`} className="pc-av">📈</Link>
        <div>
          <Link href={`/i/${inf.handle}`}>
            <div className="pc-name">{name}</div>
          </Link>
          <div className="pc-handle">
            @{inf.handle} · {formatDateTime(post.postedAt)}
          </div>
        </div>
      </div>

      <div className="pc-text">
        <CashtagText text={post.contentText} />
      </div>

      <div className="pc-src">
        {post.url && (
          <a href={post.url} target="_blank" rel="noreferrer">查看原帖 ↗</a>
        )}
        <span>非投资建议</span>
      </div>

      <div className="ai-box">
        <div className="ai-label">🤖 AI 分析</div>
        {post.analysis ? (
          <div style={{ fontSize: "0.85rem" }}>{post.analysis.summary}</div>
        ) : (
          <div style={{ color: "var(--text-tertiary)", fontSize: "0.82rem" }}>
            分析将在 M3（Agent 切片）接入：自动抽取 ticker / 方向 + 摘要 + 外部数据（行情 / 新闻 / 财报…）。
          </div>
        )}
      </div>
    </article>
  );
}
