import { isAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { deletePost, reanalyzePost } from "../actions";
import { formatDateTime } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function AdminPosts() {
  if (!(await isAdmin())) notFound();

  const posts = await prisma.post.findMany({
    orderBy: { postedAt: "desc" },
    take: 100,
    include: { influencer: true },
  });

  return (
    <>
      <h1 className="page-title">帖子管理</h1>
      <p className="page-sub">最近 {posts.length} 条 · 删除 / 重新分析</p>

      <div className="dir-grid">
        {posts.map((p) => (
          <div key={p.id} className="dir-card">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>
                {p.influencer.displayName ?? p.influencer.handle}{" "}
                <span style={{ fontFamily: "var(--mono)", fontSize: "0.64rem", color: "var(--text-tertiary)" }}>
                  · {p.analysisStatus} · {formatDateTime(p.postedAt)}
                </span>
              </div>
              <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {p.contentText}
              </div>
            </div>
            <form action={reanalyzePost}>
              <input type="hidden" name="id" value={p.id} />
              <button className="btn ghost" type="submit">重新分析</button>
            </form>
            <form action={deletePost}>
              <input type="hidden" name="id" value={p.id} />
              <button className="btn ghost" type="submit">删除</button>
            </form>
          </div>
        ))}
        {posts.length === 0 && <div className="empty">还没有帖子。</div>}
      </div>
    </>
  );
}
