"use client";

import { useEffect } from "react";
import { getFollows } from "@/lib/follow-client";

// 登录后把浏览器本地关注列表并入服务端 follows（一次性，幂等）。
// 仅在登录态由 layout 渲染。
export function FollowSync() {
  useEffect(() => {
    const KEY = "x2t_follows_merged";
    if (localStorage.getItem(KEY)) return;
    const follows = getFollows();
    if (follows.length === 0) {
      localStorage.setItem(KEY, "1");
      return;
    }
    fetch("/api/follows/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ influencerIds: follows }),
    })
      .then(() => localStorage.setItem(KEY, "1"))
      .catch(() => {});
  }, []);

  return null;
}
