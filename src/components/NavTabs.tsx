"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "信号流" },
  { href: "/graph", label: "图谱" },
  { href: "/following", label: "关注" },
  { href: "/submit", label: "提交" },
];

export function NavTabs({ userEmail, isAdmin = false }: { userEmail: string | null; isAdmin?: boolean }) {
  const pathname = usePathname();
  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <nav className="nav">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} className={active(t.href) ? "tab active" : "tab"}>
          {t.label}
        </Link>
      ))}
      {isAdmin && (
        <Link href="/admin" className={active("/admin") ? "tab active" : "tab"}>
          管理
        </Link>
      )}
      {userEmail ? (
        <form action="/api/auth/logout" method="post">
          <button type="submit" className="tab" title={userEmail}>登出</button>
        </form>
      ) : (
        <Link href="/login" className={active("/login") ? "tab active" : "tab"}>登录</Link>
      )}
    </nav>
  );
}
