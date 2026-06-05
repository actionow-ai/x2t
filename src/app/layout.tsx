import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "X2T · 金融博主信号聚合",
  description: "订阅金融博主，第一时间拿到信号与 AI 分析。非投资建议。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <header className="site-header">
          <div className="inner">
            <Link href="/" className="brand">
              X2T<span className="dot">.</span>
            </Link>
            <nav className="nav">
              <Link href="/">信号流</Link>
              <Link href="/graph">图谱</Link>
              <Link href="/submit">提交帖子</Link>
            </nav>
          </div>
        </header>
        <div className="disclaimer-bar">
          ⚠️ 非投资建议 · X2T 仅聚合公开内容与公开市场数据，不构成任何买卖建议
        </div>
        <main>
          <div className="container">{children}</div>
        </main>
      </body>
    </html>
  );
}
