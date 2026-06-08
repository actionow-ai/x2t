import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { FollowSync } from "@/components/FollowSync";
import { TickerTape } from "@/components/TickerTape";
import { PageFx } from "@/components/PageFx";
import { NavTabs } from "@/components/NavTabs";
import { LangProvider } from "@/components/LangProvider";
import { LangSwitch } from "@/components/LangSwitch";
import { getLocale } from "@/lib/i18n-server";
import { getDict } from "@/lib/i18n";
import "./globals.css";

export const metadata: Metadata = {
  title: "X2T · 金融博主信号聚合 / Signal aggregation",
  description: "订阅金融博主，第一时间拿到信号与 AI 分析。非投资建议。",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const admin = await isAdmin();
  const locale = await getLocale();
  const t = getDict(locale);

  return (
    <html lang={locale === "zh" ? "zh-CN" : "en"}>
      <body>
        <LangProvider locale={locale}>
          <TickerTape />
          <header className="site-header">
            <div className="inner">
              <Link href="/" className="brand">X2T</Link>
              <span className="masthead-tag">{t.header.masthead}</span>
              <NavTabs userEmail={user?.email ?? null} isAdmin={admin} />
              <LangSwitch />
            </div>
          </header>
          <div className="disclaimer-bar">{t.header.disclaimer}</div>
          <main>
            <div className="container">
              <PageFx>{children}</PageFx>
            </div>
          </main>
          {user && <FollowSync />}
        </LangProvider>
      </body>
    </html>
  );
}
