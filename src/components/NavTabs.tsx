"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "./LangProvider";

export function NavTabs({ userEmail, isAdmin = false }: { userEmail: string | null; isAdmin?: boolean }) {
  const pathname = usePathname();
  const t = useT();
  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  const tabs = [
    { href: "/", label: t.nav.signals },
    { href: "/graph", label: t.nav.graph },
    { href: "/following", label: t.nav.following },
    { href: "/submit", label: t.nav.submit },
  ];

  return (
    <nav className="nav">
      {tabs.map((tab) => (
        <Link key={tab.href} href={tab.href} className={active(tab.href) ? "tab active" : "tab"}>
          {tab.label}
        </Link>
      ))}
      {isAdmin && (
        <Link href="/admin" className={active("/admin") ? "tab active" : "tab"}>
          {t.nav.admin}
        </Link>
      )}
      {userEmail ? (
        <form action="/api/auth/logout" method="post">
          <button type="submit" className="tab" title={userEmail}>{t.nav.logout}</button>
        </form>
      ) : (
        <Link href="/login" className={active("/login") ? "tab active" : "tab"}>{t.nav.login}</Link>
      )}
    </nav>
  );
}
