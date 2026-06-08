"use client";

import { useRouter } from "next/navigation";

// 桌面端：拦截卡片里指向 /p/<id> 的点击 → 改为 ?s=<id>（右栏显示详情，左列表常驻）。
// 移动端（<900px）：不拦截，走默认整页跳转 /p/<id>。
export function SelectableFeed({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  function onClick(e: React.MouseEvent) {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey) return;
    if (!window.matchMedia("(min-width: 900px)").matches) return;
    const a = (e.target as HTMLElement).closest('a[href^="/p/"]') as HTMLAnchorElement | null;
    if (!a) return;
    const id = (a.getAttribute("href") || "").replace("/p/", "").split(/[?#]/)[0];
    if (!id) return;
    e.preventDefault();
    router.replace(`/?s=${id}`, { scroll: false });
  }

  return <div onClick={onClick}>{children}</div>;
}
