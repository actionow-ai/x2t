"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useT } from "./LangProvider";

// 搜索框:回车跳 /search?q=。用于站点 header(桌面)与 /search 页顶部(预填当前 q)。
export function SearchBox({ initial = "", autoFocus = false }: { initial?: string; autoFocus?: boolean }) {
  const router = useRouter();
  const t = useT();
  const [q, setQ] = useState(initial);
  return (
    <form
      className="search-box"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const v = q.trim();
        if (v) router.push(`/search?q=${encodeURIComponent(v)}`);
      }}
    >
      <input
        className="search-input"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t.search.placeholder}
        aria-label={t.search.placeholder}
        autoFocus={autoFocus}
      />
    </form>
  );
}
