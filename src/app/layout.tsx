import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { FollowSync } from "@/components/FollowSync";
import { TickerTape } from "@/components/TickerTape";
import { PageFx } from "@/components/PageFx";
import { NavTabs } from "@/components/NavTabs";
import "./globals.css";

export const metadata: Metadata = {
  title: "X2T · 金融博主信号聚合",
  description: "订阅金融博主，第一时间拿到信号与 AI 分析。非投资建议。",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <html lang="zh-CN">
      <body>
        <TickerTape />
        <header className="site-header">
          <div className="inner">
            <Link href="/" className="brand">X2T</Link>
            <span className="masthead-tag">Signals · Intelligence</span>
            <NavTabs userEmail={user?.email ?? null} />
          </div>
        </header>
        <div className="disclaimer-bar">非投资建议 · 仅聚合公开内容与公开市场数据 · NOT FINANCIAL ADVICE</div>
        <main>
          <div className="container">
            <PageFx>{children}</PageFx>
          </div>
        </main>
        {user && <FollowSync />}
      </body>
    </html>
  );
}
