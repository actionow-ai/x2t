"use client";

import { useRouter } from "next/navigation";
import { useLocale } from "./LangProvider";
import { LOCALE_COOKIE, type Locale } from "@/lib/i18n";

// 语言切换：写 cookie + 刷新（服务端组件按新 cookie 重渲染）。
export function LangSwitch() {
  const router = useRouter();
  const locale = useLocale();

  function set(l: Locale) {
    if (l === locale) return;
    document.cookie = `${LOCALE_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }

  return (
    <div className="lang-switch" role="group" aria-label="Language">
      <button className={`lang-btn${locale === "zh" ? " on" : ""}`} onClick={() => set("zh")} aria-pressed={locale === "zh"}>中</button>
      <button className={`lang-btn${locale === "en" ? " on" : ""}`} onClick={() => set("en")} aria-pressed={locale === "en"}>EN</button>
    </div>
  );
}
