import { prisma } from "@/lib/db";
import { PostCard } from "@/components/PostCard";
import { FollowButton } from "@/components/FollowButton";
import { AvatarInner } from "@/components/Avatar";
import { getCurrentUserId } from "@/lib/auth";
import { formatDateTime } from "@/lib/time";
import { getLocale } from "@/lib/i18n-server";
import { getDict } from "@/lib/i18n";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function InfluencerPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const locale = await getLocale();
  const t = getDict(locale);

  const influencer = await prisma.influencer.findFirst({
    where: { handle },
    include: {
      posts: {
        orderBy: { postedAt: "desc" },
        take: 50,
        select: {
          id: true,
          contentText: true,
          contentZh: true,
          contentEn: true,
          url: true,
          postedAt: true,
          influencer: { select: { handle: true, displayName: true, avatarUrl: true } },
          analysis: { select: { summary: true, summaryEn: true, overallStance: true } },
          tickers: { select: { symbol: true, stance: true } },
        },
      },
    },
  });
  if (!influencer) notFound();

  const name = influencer.displayName ?? influencer.handle;

  const userId = await getCurrentUserId();
  const followed = userId
    ? !!(await prisma.follow.findUnique({ where: { userId_influencerId: { userId, influencerId: influencer.id } } }))
    : false;

  return (
    <>
      <div className="inf-header">
        <div className="inf-av"><AvatarInner src={influencer.avatarUrl} name={name} /></div>
        <div style={{ flex: 1 }}>
          <div className="inf-name">{name}</div>
          <div className="inf-handle">
            @{influencer.handle} · {influencer.platform}
          </div>
          {influencer.bio && <div className="inf-bio">{influencer.bio}</div>}
          <div className="inf-meta">
            {influencer.posts.length} {t.influencer.postsWord}
            {influencer.lastFetchedAt ? ` · ${t.influencer.lastFetch} ${formatDateTime(influencer.lastFetchedAt, locale)}` : ""}
          </div>
          {influencer.fetchError && (
            <div className="inf-meta" style={{ color: "var(--error)", marginTop: "0.3rem" }}>
              {t.influencer.fetchError}：{influencer.fetchError}
            </div>
          )}
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.7rem", flexWrap: "wrap" }}>
            <FollowButton influencerId={influencer.id} isLoggedIn={!!userId} initiallyFollowed={followed} />
            <a className="btn ghost" href={`/i/${influencer.handle}/rss`}>{t.influencer.rss}</a>
          </div>
        </div>
      </div>

      {influencer.posts.length === 0 ? (
        <div className="empty">{t.influencer.noPosts}</div>
      ) : (
        <div className="feed">
          {influencer.posts.map((p) => (
            <PostCard key={p.id} post={p} locale={locale} />
          ))}
        </div>
      )}
    </>
  );
}
