import Link from "next/link";
import { unstable_cache } from "next/cache";
import { getLeaderboard } from "@/lib/stance";
import { isNewsAccount } from "@/lib/account";
import { getLocale } from "@/lib/i18n-server";
import { getDict } from "@/lib/i18n";

export const dynamic = "force-dynamic";

// 排行榜对每个博主跑一遍回测,偏重 → 缓存 1h。
const getLeaderboardCached = unstable_cache(() => getLeaderboard(), ["leaderboard"], { revalidate: 3600 });

export default async function LeaderboardPage() {
  const locale = await getLocale();
  const t = getDict(locale);
  const rows = await getLeaderboardCached();

  return (
    <>
      <h1 className="page-title">{t.board.title}</h1>
      <p className="page-sub">{t.board.sub}</p>

      {rows.length === 0 ? (
        <div className="empty">{t.board.empty}</div>
      ) : (
        <>
          <div className="lb">
            <div className="lb-row lb-head">
              <span className="lb-rank">#</span>
              <span className="lb-name">{t.board.blogger}</span>
              <span className="lb-num">{t.board.beatRate}</span>
              <span className="lb-num">{t.board.excess}</span>
              <span className="lb-num">{t.board.samples}</span>
            </div>
            {rows.map((r, i) => (
              <Link key={r.handle} href={`/i/${r.handle}`} className="lb-row">
                <span className="lb-rank">{i + 1}</span>
                <span className="lb-name">
                  {r.displayName ?? r.handle}
                  {r.significant && <span className="lb-sig" title={t.board.sigHint}>★</span>}
                  {isNewsAccount(r.handle) && <span className="news-tag">{t.influencer.newsAccount}</span>}
                </span>
                <span className={`lb-num ${r.beatRate >= 0.5 ? "up" : "dn"}`}>{Math.round(r.beatRate * 100)}%</span>
                <span className={`lb-num ${r.avgExcess >= 0 ? "up" : "dn"}`}>
                  {r.avgExcess > 0 ? "+" : ""}
                  {(r.avgExcess * 100).toFixed(1)}%
                </span>
                <span className="lb-num">{r.samples}</span>
              </Link>
            ))}
          </div>
          <p className="method-note">{t.board.methodNote}</p>
        </>
      )}
    </>
  );
}
