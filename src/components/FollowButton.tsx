"use client";

import { useEffect, useState } from "react";
import { isFollowing, toggleFollow, syncFollowFilter } from "@/lib/follow-client";

export function FollowButton({ influencerId }: { influencerId: string }) {
  const [following, setFollowing] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setFollowing(isFollowing(influencerId));
    setReady(true);
  }, [influencerId]);

  async function onClick() {
    const next = toggleFollow(influencerId);
    setFollowing(next.includes(influencerId));
    await syncFollowFilter();
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
      {following ? "✓ 已关注" : "☆ 关注"}
    </button>
  );
}
