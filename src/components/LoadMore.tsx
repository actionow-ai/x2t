"use client";

import { useState, type ReactNode } from "react";

type LoadResult = { nodes: ReactNode; nextCursor: number | null };

// 通用「加载更多」:server action(已 .bind 绑好上下文)按游标取下一页、服务端渲染好 PostCard,
// client 追加。游标=最后一项 postedAt(ms);action 回 nextCursor=null 表示到底。信息流 / 博主页 / 搜索复用。
export function LoadMore({
  load,
  initialCursor,
  label,
  loadingLabel,
}: {
  load: (beforeMs: number) => Promise<LoadResult>;
  initialCursor: number | null;
  label: string;
  loadingLabel: string;
}) {
  const [extra, setExtra] = useState<ReactNode[]>([]);
  const [cursor, setCursor] = useState<number | null>(initialCursor);
  const [loading, setLoading] = useState(false);

  async function more() {
    if (cursor === null || loading) return;
    setLoading(true);
    try {
      const r = await load(cursor);
      setExtra((e) => [...e, r.nodes]);
      setCursor(r.nextCursor);
    } finally {
      setLoading(false);
    }
  }

  if (cursor === null && extra.length === 0) return null;
  return (
    <>
      {extra}
      {cursor !== null && (
        <div className="load-more-wrap">
          <button className="btn ghost" onClick={more} disabled={loading} aria-busy={loading}>
            {loading ? loadingLabel : label}
          </button>
        </div>
      )}
    </>
  );
}
