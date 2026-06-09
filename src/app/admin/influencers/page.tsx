import { isAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { getLocale } from "@/lib/i18n-server";
import { getDict } from "@/lib/i18n";
import { addInfluencer, toggleInfluencer, deleteInfluencer } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminInfluencers() {
  if (!(await isAdmin())) notFound();
  const t = getDict(await getLocale()).admin;

  const list = await prisma.influencer.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { posts: true } } },
  });

  return (
    <>
      <h1 className="page-title">{t.cardInf}</h1>
      <p className="page-sub">{t.infSub}</p>

      <form className="form" action={addInfluencer} style={{ marginBottom: "1.5rem" }}>
        <div>
          <label htmlFor="inf-handle">handle *</label>
          <input id="inf-handle" name="handle" required placeholder="serenity" />
        </div>
        <div>
          <label htmlFor="inf-displayName">{t.displayName}</label>
          <input id="inf-displayName" name="displayName" placeholder="Serenity" />
        </div>
        <div>
          <label htmlFor="inf-feedUrl">RSS feedUrl</label>
          <input id="inf-feedUrl" name="feedUrl" placeholder="https://rsshub.app/twitter/user/serenity" />
        </div>
        <button className="btn primary" type="submit" style={{ alignSelf: "flex-start" }}>{t.addUpdate}</button>
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
                  @{inf.handle} · {inf._count.posts} {t.postsWord} · {inf.active ? "active" : t.inactive}
                  {inf.fetchError ? ` · ${t.fetchError}` : ""}
                </div>
              </div>
              <form action={toggleInfluencer}>
                <input type="hidden" name="id" value={inf.id} />
                <button className="btn ghost" type="submit">{inf.active ? t.disable : t.enable}</button>
              </form>
              <form action={deleteInfluencer}>
                <input type="hidden" name="id" value={inf.id} />
                <button className="btn ghost" type="submit">{t.delete}</button>
              </form>
            </div>
          );
        })}
      </div>
    </>
  );
}
