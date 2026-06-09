import { prisma } from "@/lib/db";
import { FollowingList } from "@/components/FollowingList";
import { PushToggle } from "@/components/PushToggle";
import { EmailDigestToggle } from "@/components/EmailDigestToggle";
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
  // 邮件摘要订阅状态(仅登录用户)
  const digestOptIn = userId ? !!(await prisma.user.findUnique({ where: { id: userId }, select: { digestOptIn: true } }))?.digestOptIn : false;

  const list = influencers.map((inf) => ({
    id: inf.id,
    handle: inf.handle,
    displayName: inf.displayName,
    avatarUrl: inf.avatarUrl,
    posts: inf._count.posts,
    fetchError: !!inf.fetchError,
  }));

  return (
    <div className="narrow">
      <h1 className="page-title">{t.following.title}</h1>
      <p className="page-sub">{userId ? t.following.subLoggedIn : t.following.subAnon}</p>

      {influencers.length === 0 ? (
        <div className="empty">
          {t.following.empty} <Link href="/submit" style={{ color: "var(--accent)" }}>{t.nav.submit}</Link>
        </div>
      ) : (
        <>
          <div className="follow-pushbar">
            <PushToggle />
            {userId && <EmailDigestToggle initial={digestOptIn} />}
            <span className="hint" style={{ margin: 0 }}>{userId ? t.following.digestHint : t.following.pushHint}</span>
          </div>
          <FollowingList influencers={list} isLoggedIn={!!userId} followed={[...followed]} />
        </>
      )}
    </div>
  );
}
