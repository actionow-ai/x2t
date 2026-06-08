import Link from "next/link";
import { prisma } from "@/lib/db";
import { PostCard } from "@/components/PostCard";
import { PushToggle } from "@/components/PushToggle";
import { SelectableFeed } from "@/components/SelectableFeed";
import { getPostDetail, PostDetail } from "@/components/PostDetail";
import { getLocale } from "@/lib/i18n-server";
import { getDict } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function FeedPage({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const { s } = await searchParams;
  const locale = await getLocale();
  const t = getDict(locale);

  const posts = await prisma.post.findMany({
    orderBy: { postedAt: "desc" },
    take: 50,
    include: { influencer: true, analysis: true, tickers: true },
  });
  const detail = s ? await getPostDetail(s) : null;

  return (
    <>
      <h1 className="page-title">{t.home.title}</h1>
      <p className="page-sub">{t.home.sub}</p>

      <div style={{ display: "flex", gap: "0.6rem", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap" }}>
        <PushToggle />
        <a className="btn ghost" href="/rss/all">{t.home.allRss}</a>
      </div>

      {posts.length === 0 ? (
        <div className="empty">
          {t.home.empty} <Link href="/submit" style={{ color: "var(--accent)" }}>{t.home.submitOne}</Link>。
        </div>
      ) : (
        <div className={`workspace${detail ? " split" : ""}`}>
          <div className="ws-list">
            <SelectableFeed>
              <div className="feed">
                {posts.map((p) => (
                  <PostCard key={p.id} post={p} selected={p.id === s} locale={locale} />
                ))}
              </div>
            </SelectableFeed>
          </div>

          {detail && (
            <div className="ws-detail">
              <div className="ws-detail-bar">
                <Link href="/" scroll={false} className="btn ghost">{t.home.collapse}</Link>
                <Link href={`/p/${detail.post.id}`} className="btn ghost">{t.home.fullPage}</Link>
              </div>
              <PostDetail post={detail.post} dataBySymbol={detail.dataBySymbol} locale={locale} />
            </div>
          )}
        </div>
      )}
    </>
  );
}
