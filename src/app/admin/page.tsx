import { isAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!(await isAdmin())) notFound();

  const [posts, analyses, users, influencers] = await Promise.all([
    prisma.post.count(),
    prisma.postAnalysis.count(),
    prisma.user.count(),
    prisma.influencer.count(),
  ]);

  return (
    <>
      <h1 className="page-title">管理后台</h1>
      <p className="page-sub">数据管理 · 仅管理员可见</p>
      <div className="dir-grid">
        <Link href="/admin/influencers" className="dir-card">
          <div style={{ flex: 1 }}>
            <strong style={{ fontWeight: 800 }}>博主管理</strong>
            <div style={{ fontFamily: "var(--mono)", fontSize: "0.72rem", color: "var(--text-secondary)" }}>{influencers} 个博主源 · 增删 / 启停 / 编辑源</div>
          </div>
        </Link>
        <Link href="/admin/posts" className="dir-card">
          <div style={{ flex: 1 }}>
            <strong style={{ fontWeight: 800 }}>帖子管理</strong>
            <div style={{ fontFamily: "var(--mono)", fontSize: "0.72rem", color: "var(--text-secondary)" }}>{posts} 帖 · {analyses} 已分析 · 删除 / 重新分析</div>
          </div>
        </Link>
        <Link href="/admin/users" className="dir-card">
          <div style={{ flex: 1 }}>
            <strong style={{ fontWeight: 800 }}>用户管理</strong>
            <div style={{ fontFamily: "var(--mono)", fontSize: "0.72rem", color: "var(--text-secondary)" }}>{users} 个用户 · 删除</div>
          </div>
        </Link>
      </div>
    </>
  );
}
