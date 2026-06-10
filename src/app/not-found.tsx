import type { Metadata } from "next";
import Link from "next/link";
import { getLocale } from "@/lib/i18n-server";

// 404 页显式 noindex,覆盖根布局的 index,follow,消除"index,follow + 自动 noindex"冲突信号(bb-func seo-3)。
export const metadata: Metadata = { robots: { index: false, follow: false } };

// 全局 404:按 locale 渲染(原先落到 Next 默认英文 404 页)。
export default async function NotFound() {
  const en = (await getLocale()) === "en";
  return (
    <div className="errbox">
      <h2>{en ? "Page not found" : "页面不存在"}</h2>
      <p>{en ? "This page does not exist or has been removed." : "该页面不存在或已被移除。"}</p>
      <Link className="btn primary" href="/">&larr; X2T</Link>
    </div>
  );
}
