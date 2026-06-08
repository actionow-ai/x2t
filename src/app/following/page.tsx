import { prisma } from "@/lib/db";
import { FollowButton } from "@/components/FollowButton";
import { getCurrentUserId } from "@/lib/auth";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function FollowingPage() {
  const userId = await getCurrentUserId();

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
      <h1 className="page-title">关注管理</h1>
      <p className="page-sub">
        管理你关注的博主{userId ? "（已登录 · 云端同步）" : "（未登录 · 存本地，登录后自动云同步）"}。
      </p>

      {influencers.length === 0 ? (
        <div className="empty">
          还没有博主源。<br />
          跑 <code>pnpm db:seed</code> 或在 <Link href="/submit" style={{ color: "var(--accent)" }}>提交</Link> 页人工添加。
        </div>
      ) : (
        <div className="dir-grid">
          {influencers.map((inf) => {
            const name = inf.displayName ?? inf.handle;
            return (
              <div key={inf.id} className="dir-card">
                <div className="pc-av" style={{ width: "2.4rem", height: "2.4rem" }}>
                  {name.slice(0, 1).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Link href={`/i/${inf.handle}`}>
                    <strong style={{ fontWeight: 800 }}>{name}</strong>
                  </Link>
                  <div style={{ fontFamily: "var(--mono)", fontSize: "0.7rem", color: "var(--text-secondary)" }}>
                    @{inf.handle} · {inf._count.posts} 帖{inf.fetchError ? " · 抓取异常" : ""}
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
