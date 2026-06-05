import Link from "next/link";
import { prisma } from "@/lib/db";
import { PostCard } from "@/components/PostCard";
import { PushToggle } from "@/components/PushToggle";

export const dynamic = "force-dynamic";

export default async function FeedPage() {
  const posts = await prisma.post.findMany({
    orderBy: { postedAt: "desc" },
    take: 50,
    include: { influencer: true, analysis: true },
  });

  return (
    <>
      <h1 className="page-title">信号流</h1>
      <p className="page-sub">你关注的金融博主，最新帖子。</p>

      <div style={{ display: "flex", gap: "0.6rem", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap" }}>
        <PushToggle />
        <a className="btn ghost" href="/rss/all">🔗 全站 RSS</a>
      </div>

      {posts.length === 0 ? (
        <div className="empty">
          还没有帖子。
          <br />
          跑一轮抓取：<code>pnpm poll:once</code>
          <br />
          或 <Link href="/submit" style={{ color: "var(--accent)" }}>手动提交一条</Link>。
        </div>
      ) : (
        <div className="feed">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </div>
      )}
    </>
  );
}
