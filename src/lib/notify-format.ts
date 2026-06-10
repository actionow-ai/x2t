// 服务端外发通知(web-push / 告警)的双语文案。统一出口,替换 push.ts 私有 stanceZh、
// alerts.ts 中文硬编码——让 EN 用户也能收到英文通知(据 user.locale;匿名默认 zh)。
// 团队规范:前端/通知禁 emoji,标题用纯文字前缀(原 ⚑/⇄ 在部分 Android 通知栏会按 emoji 渲染)。
export type NotifyLocale = "zh" | "en";

const STANCE: Record<NotifyLocale, Record<string, string>> = {
  zh: { bullish: "看多", bearish: "看空", neutral: "中性" },
  en: { bullish: "Bullish", bearish: "Bearish", neutral: "Neutral" },
};

export function stanceText(s: string, locale: NotifyLocale): string {
  return STANCE[locale]?.[s] ?? STANCE.zh[s] ?? s;
}

export function pickLocale(v: string | null | undefined): NotifyLocale {
  return v === "en" ? "en" : "zh";
}

export const notify = {
  newPost: (locale: NotifyLocale, name: string) => (locale === "en" ? `${name} posted` : `${name} 发新帖`),
  flipTitle: (locale: NotifyLocale, name: string) => (locale === "en" ? `${name}: stance flip` : `${name} 立场转向`),
  // → = →(几何箭头,非 emoji)
  flipLine: (locale: NotifyLocale, symbol: string, prev: string, next: string) => `$${symbol} ${stanceText(prev, locale)}→${stanceText(next, locale)}`,
  alertTitle: (locale: NotifyLocale, symbol: string) => (locale === "en" ? `$${symbol} alert triggered` : `$${symbol} 触发预警`),
  condBull: (locale: NotifyLocale, n: number, min: number) => (locale === "en" ? `${n} bullish ≥ ${min}` : `看多 ${n}≥${min}`),
  condBear: (locale: NotifyLocale, n: number, min: number) => (locale === "en" ? `${n} bearish ≥ ${min}` : `看空 ${n}≥${min}`),
  condFlip: (locale: NotifyLocale) => (locale === "en" ? "stance flip" : "立场翻转"),
};
