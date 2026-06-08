import { isAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { deleteUser } from "../actions";
import { formatDateTime } from "@/lib/time";
import { getLocale } from "@/lib/i18n-server";
import { getDict } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function AdminUsers() {
  if (!(await isAdmin())) notFound();
  const t = getDict(await getLocale()).admin;

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { follows: true } } },
  });

  return (
    <>
      <h1 className="page-title">{t.cardUsers}</h1>
      <p className="page-sub">{users.length} {t.usersWord}</p>

      <div className="dir-grid">
        {users.map((u) => (
          <div key={u.id} className="dir-card">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "var(--mono)", fontSize: "0.85rem" }}>{u.email}</div>
              <div style={{ fontFamily: "var(--mono)", fontSize: "0.66rem", color: "var(--text-tertiary)" }}>
                {u._count.follows} {t.followsWord} · {formatDateTime(u.createdAt)}
              </div>
            </div>
            <form action={deleteUser}>
              <input type="hidden" name="id" value={u.id} />
              <button className="btn ghost" type="submit">{t.delete}</button>
            </form>
          </div>
        ))}
        {users.length === 0 && <div className="empty">{t.noUsers}</div>}
      </div>
    </>
  );
}
