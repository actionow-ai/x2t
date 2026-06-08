import { isAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { addInfluencer, toggleInfluencer, deleteInfluencer } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminInfluencers() {
  if (!(await isAdmin())) notFound();

  const list = await prisma.influencer.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { posts: true } } },
  });

  return (
    <>
      <h1 className="page-title">博主管理</h1>
      <p className="page-sub">添加 / 启停 / 删除博主源</p>

      <form className="form" action={addInfluencer} style={{ marginBottom: "1.5rem" }}>
        <div>
          <label>handle *</label>
          <input name="handle" required placeholder="serenity" />
        </div>
        <div>
          <label>显示名</label>
          <input name="displayName" placeholder="Serenity" />
        </div>
        <div>
          <label>RSS feedUrl</label>
          <input name="feedUrl" placeholder="https://rsshub.app/twitter/user/serenity" />
        </div>
        <button className="btn primary" type="submit" style={{ alignSelf: "flex-start" }}>添加 / 更新</button>
      </form>

      <div className="dir-grid">
        {list.map((inf) => {
          const name = inf.displayName ?? inf.handle;
          return (
            <div key={inf.id} className="dir-card">
              <div className="pc-av" style={{ width: "2.2rem", height: "2.2rem" }}>{name.slice(0, 1).toUpperCase()}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong style={{ fontWeight: 800 }}>{name}</strong>
                <div style={{ fontFamily: "var(--mono)", fontSize: "0.7rem", color: "var(--text-secondary)" }}>
                  @{inf.handle} · {inf._count.posts} 帖 · {inf.active ? "active" : "停用"}
                  {inf.fetchError ? " · 抓取异常" : ""}
                </div>
              </div>
              <form action={toggleInfluencer}>
                <input type="hidden" name="id" value={inf.id} />
                <button className="btn ghost" type="submit">{inf.active ? "停用" : "启用"}</button>
              </form>
              <form action={deleteInfluencer}>
                <input type="hidden" name="id" value={inf.id} />
                <button className="btn ghost" type="submit">删除</button>
              </form>
            </div>
          );
        })}
      </div>
    </>
  );
}
