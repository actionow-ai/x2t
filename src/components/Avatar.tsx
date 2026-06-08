"use client";

import { useState } from "react";
import { proxiedImg } from "@/lib/img";

// 头像：有 avatarUrl 经自家代理加载（绕过 twimg 等被墙/防盗链）；加载失败或无图 → 名字首字母兜底，绝不裂图。
export function AvatarInner({ src, name }: { src?: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  const initial = (name || "?").slice(0, 1).toUpperCase();
  const proxied = proxiedImg(src);
  if (!proxied || failed) return <>{initial}</>;
  // 普通 <img>（非 next/image），onError 时切首字母
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={proxied} alt={name} loading="lazy" onError={() => setFailed(true)} />;
}
