import { isAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { getLocale } from "@/lib/i18n-server";
import { getDict } from "@/lib/i18n";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!(await isAdmin())) notFound();
  const t = getDict(await getLocale()).admin;

  const [posts, analyses, users, influencers] = await Promise.all([
    prisma.post.count(),
    prisma.postAnalysis.count(),
    prisma.user.count(),
    prisma.influencer.count(),
  ]);

  return (
    <>
      <h1 className="page-title">{t.title}</h1>
      <p className="page-sub">{t.sub}</p>
      <div className="dir-grid">
        <Link href="/admin/influencers" className="dir-card">
          <div style={{ flex: 1 }}>
            <strong style={{ fontWeight: 800 }}>{t.cardInf}</strong>
            <div style={{ fontFamily: "var(--mono)", fontSize: "0.72rem", color: "var(--text-secondary)" }}>{influencers} {t.sourcesWord} · {t.cardInfDesc}</div>
          </div>
        </Link>
        <Link href="/admin/posts" className="dir-card">
          <div style={{ flex: 1 }}>
            <strong style={{ fontWeight: 800 }}>{t.cardPosts}</strong>
            <div style={{ fontFamily: "var(--mono)", fontSize: "0.72rem", color: "var(--text-secondary)" }}>{posts} {t.postsWord} · {analyses} {t.analyzed} · {t.cardPostsDesc}</div>
          </div>
        </Link>
        <Link href="/admin/users" className="dir-card">
          <div style={{ flex: 1 }}>
            <strong style={{ fontWeight: 800 }}>{t.cardUsers}</strong>
            <div style={{ fontFamily: "var(--mono)", fontSize: "0.72rem", color: "var(--text-secondary)" }}>{users} {t.usersWord} · {t.cardUsersDesc}</div>
          </div>
        </Link>
      </div>
    </>
  );
}
