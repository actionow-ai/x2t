import { prisma } from "@/lib/db";
import { FollowButton } from "@/components/FollowButton";
import { AvatarInner } from "@/components/Avatar";
import { getCurrentUserId } from "@/lib/auth";
import { getLocale } from "@/lib/i18n-server";
import { getDict } from "@/lib/i18n";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function FollowingPage() {
  const userId = await getCurrentUserId();
  const t = getDict(await getLocale());

  const influencers = await prisma.influencer.findMany({
    where: { active: true },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { posts: true } } },
  });

  const followed = userId
    ? new Set(
        (await prisma.follow.findMany({ where: { userId }, select: { influencerId: true } })).map((f) => f.influencerId),
      )
    : new Set<string>();

  return (
    <>
      <h1 className="page-title">{t.following.title}</h1>
      <p className="page-sub">{userId ? t.following.subLoggedIn : t.following.subAnon}</p>

      {influencers.length === 0 ? (
        <div className="empty">
          {t.following.empty} <Link href="/submit" style={{ color: "var(--accent)" }}>{t.nav.submit}</Link>
        </div>
      ) : (
        <div className="dir-grid">
          {influencers.map((inf) => {
            const name = inf.displayName ?? inf.handle;
            return (
              <div key={inf.id} className="dir-card">
                <div className="pc-av" style={{ width: "2.4rem", height: "2.4rem" }}>
                  <AvatarInner src={inf.avatarUrl} name={name} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Link href={`/i/${inf.handle}`}>
                    <strong style={{ fontWeight: 800 }}>{name}</strong>
                  </Link>
                  <div style={{ fontFamily: "var(--mono)", fontSize: "0.7rem", color: "var(--text-secondary)" }}>
                    @{inf.handle} · {inf._count.posts} {t.following.postsWord}{inf.fetchError ? ` · ${t.following.fetchError}` : ""}
                  </div>
                </div>
                <FollowButton influencerId={inf.id} isLoggedIn={!!userId} initiallyFollowed={followed.has(inf.id)} />
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
