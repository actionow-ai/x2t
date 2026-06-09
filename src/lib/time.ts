import type { Locale } from "./i18n";

// 相对时间(随 locale 切换文案);默认 zh,英文站显示英文。
export function relativeTime(date: Date, locale: Locale = "zh"): string {
  const en = locale === "en";
  const diff = Date.now() - date.getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return en ? "just now" : "刚刚";
  const m = Math.floor(s / 60);
  if (m < 60) return en ? `${m}m ago` : `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return en ? `${h}h ago` : `${h}h 前`;
  const d = Math.floor(h / 24);
  if (d < 30) return en ? `${d}d ago` : `${d} 天前`;
  return date.toLocaleDateString(en ? "en-US" : "zh-CN");
}

export function formatDateTime(date: Date, locale: Locale = "zh"): string {
  return date.toLocaleString(locale === "en" ? "en-US" : "zh-CN", { hour12: false });
}
