"use client";

import { useState } from "react";
import Link from "next/link";
import { FollowButton } from "./FollowButton";
import { AvatarInner } from "./Avatar";
import { useT } from "./LangProvider";

type Inf = { id: string; handle: string; displayName: string | null; avatarUrl: string | null; posts: number; fetchError: boolean };

export function FollowingList({ influencers, isLoggedIn, followed }: { influencers: Inf[]; isLoggedIn: boolean; followed: string[] }) {
  const t = useT();
  const [q, setQ] = useState("");
  const followedSet = new Set(followed);
  const ql = q.trim().toLowerCase();
  const list = ql
    ? influencers.filter((i) => (i.displayName ?? "").toLowerCase().includes(ql) || i.handle.toLowerCase().includes(ql))
    : influencers;

  return (
    <>
      <input
        className="dir-search"
        type="search"
        placeholder={t.following.searchPlaceholder}
        aria-label={t.following.searchPlaceholder}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {list.length === 0 ? (
        <div className="empty">{t.following.noMatch}</div>
      ) : (
        <div className="dir-grid">
          {list.map((inf) => {
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
                    @{inf.handle} · {inf.posts} {t.following.postsWord}
                    {inf.fetchError ? ` · ${t.following.fetchError}` : ""}
                  </div>
                </div>
                <FollowButton influencerId={inf.id} isLoggedIn={isLoggedIn} initiallyFollowed={followedSet.has(inf.id)} />
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
