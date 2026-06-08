import { isAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { deleteUser } from "../actions";
import { formatDateTime } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function AdminUsers() {
  if (!(await isAdmin())) notFound();

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { follows: true } } },
  });

  return (
    <>
      <h1 className="page-title">用户管理</h1>
      <p className="page-sub">{users.length} 个用户</p>

      <div className="dir-grid">
        {users.map((u) => (
          <div key={u.id} className="dir-card">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "var(--mono)", fontSize: "0.85rem" }}>{u.email}</div>
              <div style={{ fontFamily: "var(--mono)", fontSize: "0.66rem", color: "var(--text-tertiary)" }}>
                {u._count.follows} 关注 · {formatDateTime(u.createdAt)}
              </div>
            </div>
            <form action={deleteUser}>
              <input type="hidden" name="id" value={u.id} />
              <button className="btn ghost" type="submit">删除</button>
            </form>
          </div>
        ))}
        {users.length === 0 && <div className="empty">还没有用户。</div>}
      </div>
    </>
  );
}
