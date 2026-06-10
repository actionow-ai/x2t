"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import { useT } from "./LangProvider";
import { useModalA11y } from "./useModalA11y";

export function NavTabs({ userEmail, isAdmin = false }: { userEmail: string | null; isAdmin?: boolean }) {
  const pathname = usePathname();
  const t = useT();
  const [open, setOpen] = useState(false);
  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const drawerRef = useModalA11y<HTMLDivElement>(open, () => setOpen(false));

  const tabs = [
    { href: "/", label: t.nav.signals },
    { href: "/search", label: t.nav.search },
    { href: "/graph", label: t.nav.graph },
    { href: "/leaderboard", label: t.nav.board },
    { href: "/alerts", label: t.nav.alerts },
    { href: "/following", label: t.nav.following },
    { href: "/submit", label: t.nav.submit },
  ];
  if (isAdmin) tabs.push({ href: "/admin", label: t.nav.admin });

  const authItem = userEmail ? (
    <form action="/api/auth/logout" method="post" className="nav-auth">
      <button type="submit" className="tab" title={userEmail}>{t.nav.logout}</button>
    </form>
  ) : (
    <Link href="/login" className={active("/login") ? "tab active" : "tab"} onClick={() => setOpen(false)}>{t.nav.login}</Link>
  );

  return (
    <>
      {/* 桌面:横向 nav */}
      <nav className="nav nav-desktop">
        {tabs.map((tab) => (
          <Link key={tab.href} href={tab.href} className={active(tab.href) ? "tab active" : "tab"}>{tab.label}</Link>
        ))}
        {authItem}
      </nav>

      {/* 移动:汉堡按钮 → 抽屉 */}
      <button className="nav-burger" onClick={() => setOpen(true)} aria-label={t.nav.menu} aria-expanded={open}>≡</button>
      {open &&
        createPortal(
          <div className="drawer-backdrop" onClick={() => setOpen(false)} role="dialog" aria-modal="true">
            <div className="drawer" ref={drawerRef} tabIndex={-1} onClick={(e) => e.stopPropagation()} aria-labelledby="drawer-title">
              <div className="drawer-head">
                <span className="drawer-title" id="drawer-title">X2T</span>
                <button className="drawer-x" onClick={() => setOpen(false)} aria-label={t.common.close}>✕</button>
              </div>
              {tabs.map((tab) => (
                <Link key={tab.href} href={tab.href} className={`drawer-link${active(tab.href) ? " active" : ""}`} onClick={() => setOpen(false)}>
                  {tab.label}
                </Link>
              ))}
              <div className="drawer-auth">{authItem}</div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
