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
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { getLocale } from "@/lib/i18n-server";
import { getDict } from "@/lib/i18n";
import { siteMetadata, websiteJsonLd } from "@/lib/seo";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  return siteMetadata(await getLocale());
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const admin = await isAdmin();
  const locale = await getLocale();
  const t = getDict(locale);

  return (
    <html lang={locale === "zh" ? "zh-CN" : "en"}>
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd(locale)) }} />
        <GoogleAnalytics />
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
