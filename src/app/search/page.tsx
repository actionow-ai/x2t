import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { PostCard } from "@/components/PostCard";
import { LoadMore } from "@/components/LoadMore";
import { SearchBox } from "@/components/SearchBox";
import { loadMoreSearch } from "@/app/feed-actions";
import { getMyVotes } from "@/lib/reactions";
import { fetchFeedRows, searchPostsWhere, FEED_PAGE, type StanceFilter } from "@/lib/feed";
import { getLocale } from "@/lib/i18n-server";
import { getDict } from "@/lib/i18n";
import { pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ q?: string }> }): Promise<Metadata> {
  const { q } = await searchParams;
  // 搜索结果页不入索引(无限 q 组合会产生薄页/重复内容)。
  return pageMetadata({ path: "/search", title: q ? `${q}` : "Search / 搜索", noindex: true });
}

const STANCES: StanceFilter[] = ["", "bullish", "bearish", "neutral"];

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; stance?: string }> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const stance: StanceFilter = (["bullish", "bearish", "neutral"] as const).includes(sp.stance as "bullish") ? (sp.stance as StanceFilter) : "";
  const locale = await getLocale();
  const t = getDict(locale);

  if (!q) {
    return (
      <>
        <h1 className="page-title">{t.search.title}</h1>
        <p className="page-sub">{t.search.hint}</p>
        <SearchBox autoFocus />
      </>
    );
  }

  const symGuess = q.replace(/^\$/, "").toUpperCase();
  const isExactSym = /^[A-Z]{1,6}$/.test(symGuess);
  const [tickerHits, infHits, rows] = await Promise.all([
    prisma.postTicker.findMany({
      where: isExactSym ? { symbol: symGuess } : { symbol: { contains: symGuess, mode: "insensitive" } },
      distinct: ["symbol"],
      select: { symbol: true },
      take: 6,
    }),
    prisma.influencer.findMany({
      where: { optedOut: false, OR: [{ handle: { contains: q.replace(/^@/, ""), mode: "insensitive" } }, { displayName: { contains: q, mode: "insensitive" } }] },
      select: { handle: true, displayName: true },
      take: 6,
    }),
    fetchFeedRows(searchPostsWhere(q, stance)),
  ]);
  const myVotes = await getMyVotes(rows.map((p) => p.id));
  const cursor = rows.length === FEED_PAGE ? rows[rows.length - 1].postedAt : null;
  const stanceLabel = (s: StanceFilter) => (s === "" ? t.search.stanceAll : s === "bullish" ? t.stance.bullish : s === "bearish" ? t.stance.bearish : t.stance.neutral);

  return (
    <>
      <h1 className="page-title">{t.search.title}</h1>
      <SearchBox initial={q} />

      {(tickerHits.length > 0 || infHits.length > 0) && (
        <div className="search-jumps">
          {tickerHits.map((x) => (
            <Link key={`t-${x.symbol}`} href={`/t/${x.symbol}`} className="btn ghost">
              ${x.symbol}
            </Link>
          ))}
          {infHits.map((x) => (
            <Link key={`i-${x.handle}`} href={`/i/${x.handle}`} className="btn ghost">
              @{x.handle}
            </Link>
          ))}
        </div>
      )}

      <div className="seg search-stance">
        {STANCES.map((s) => (
          <Link
            key={s || "all"}
            href={`/search?q=${encodeURIComponent(q)}${s ? `&stance=${s}` : ""}`}
            className={`segbtn${stance === s ? " on" : ""}`}
          >
            {stanceLabel(s)}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="empty">{t.search.noResults}</div>
      ) : (
        <div className="feed">
          {rows.map((p) => (
            <PostCard key={p.id} post={{ ...p, postedAt: new Date(p.postedAt), myVote: myVotes[p.id] ?? 0 }} locale={locale} />
          ))}
          <LoadMore load={loadMoreSearch.bind(null, { q, stance })} initialCursor={cursor} label={t.home.loadMore} loadingLabel={t.home.loading} />
        </div>
      )}
    </>
  );
}
