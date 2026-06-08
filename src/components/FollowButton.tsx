"use client";

import { useEffect, useState } from "react";
import { isFollowing, toggleFollow, syncFollowFilter, syncFollowsCookie } from "@/lib/follow-client";
import { useT } from "./LangProvider";

export function FollowButton({
  influencerId,
  isLoggedIn = false,
  initiallyFollowed = false,
}: {
  influencerId: string;
  isLoggedIn?: boolean;
  initiallyFollowed?: boolean;
}) {
  const t = useT();
  const [following, setFollowing] = useState(isLoggedIn ? initiallyFollowed : false);
  // 登录态：服务端已给出初始值，立即 ready；匿名态：挂载后读 localStorage
  const [ready, setReady] = useState(isLoggedIn);

  useEffect(() => {
    if (!isLoggedIn) {
      setFollowing(isFollowing(influencerId));
      syncFollowsCookie(); // 保持 cookie 与本地关注一致(供首页 SSR 过滤)
      setReady(true);
    }
  }, [influencerId, isLoggedIn]);

  async function onClick() {
    if (isLoggedIn) {
      const res = await fetch("/api/follows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ influencerId }),
      });
      const data = await res.json();
      setFollowing(!!data.following);
    } else {
      const next = toggleFollow(influencerId);
      setFollowing(next.includes(influencerId));
      await syncFollowFilter();
    }
  }

  if (!ready) {
    return (
      <button className="btn ghost" disabled>
        …
      </button>
    );
  }

  return (
    <button className={following ? "btn ghost" : "btn primary"} onClick={onClick}>
      {following ? `✓ ${t.influencer.following}` : `☆ ${t.influencer.follow}`}
    </button>
  );
}
