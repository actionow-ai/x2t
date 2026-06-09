"use client";

import { useState, useTransition } from "react";
import { useT } from "./LangProvider";
import { reactToPost } from "@/lib/react-action";
import { ShareButton, type ShareSpec } from "./ShareButton";

// 赞/踩/分享 融入卡片底部。赞踩乐观更新(失败回滚),分享走弹窗。
export function Reactions({
  postId,
  likes,
  dislikes,
  myVote,
  share,
}: {
  postId: string;
  likes: number;
  dislikes: number;
  myVote: number;
  share: ShareSpec;
}) {
  const t = useT();
  const [l, setL] = useState(likes);
  const [d, setD] = useState(dislikes);
  const [vote, setVote] = useState(myVote);
  const [, start] = useTransition();

  function react(v: 1 | -1) {
    const prev = { l, d, vote };
    let nl = l;
    let nd = d;
    let nv: number;
    if (vote === v) {
      if (v === 1) nl -= 1;
      else nd -= 1;
      nv = 0;
    } else {
      if (v === 1) {
        nl += 1;
        if (vote === -1) nd -= 1;
      } else {
        nd += 1;
        if (vote === 1) nl -= 1;
      }
      nv = v;
    }
    setL(nl);
    setD(nd);
    setVote(nv);
    start(async () => {
      try {
        const r = await reactToPost(postId, v);
        setL(r.likes);
        setD(r.dislikes);
        setVote(r.myVote);
      } catch {
        setL(prev.l);
        setD(prev.d);
        setVote(prev.vote);
      }
    });
  }

  return (
    <div className="reactions">
      <button className={`react-btn${vote === 1 ? " on up" : ""}`} onClick={() => react(1)} aria-pressed={vote === 1}>
        {t.react.like}{l > 0 ? ` ${l}` : ""}
      </button>
      <button className={`react-btn${vote === -1 ? " on dn" : ""}`} onClick={() => react(-1)} aria-pressed={vote === -1}>
        {t.react.dislike}{d > 0 ? ` ${d}` : ""}
      </button>
      <ShareButton spec={share} />
    </div>
  );
}
