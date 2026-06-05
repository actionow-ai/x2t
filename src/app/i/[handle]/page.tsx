import { prisma } from "@/lib/db";
import { PostCard } from "@/components/PostCard";
import { formatDateTime } from "@/lib/time";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function InfluencerPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;

  const influencer = await prisma.influencer.findFirst({
    where: { handle },
    include: {
      posts: {
        orderBy: { postedAt: "desc" },
        take: 50,
        include: { influencer: true, analysis: true },
      },
    },
  });
  if (!influencer) notFound();

  const name = influencer.displayName ?? influencer.handle;

  return (
    <>
      <div className="inf-header">
        <div className="inf-av">📈</div>
        <div style={{ flex: 1 }}>
          <div className="inf-name">{name}</div>
          <div className="inf-handle">
            @{influencer.handle} · {influencer.platform}
          </div>
          {influencer.bio && <div className="inf-bio">{influencer.bio}</div>}
          <div className="inf-meta">
            {influencer.posts.length} 帖
            {influencer.lastFetchedAt
              ? ` · 最近抓取 ${formatDateTime(influencer.lastFetchedAt)}`
              : ""}
          </div>
          {influencer.fetchError && (
            <div className="inf-meta" style={{ color: "var(--error)", marginTop: "0.3rem" }}>
              抓取异常：{influencer.fetchError}
            </div>
          )}
        </div>
      </div>

      {influencer.posts.length === 0 ? (
        <div className="empty">该博主还没有帖子。</div>
      ) : (
        <div className="feed">
          {influencer.posts.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </div>
      )}
    </>
  );
}
