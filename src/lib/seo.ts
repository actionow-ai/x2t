import type { Metadata } from "next";
import type { Locale } from "./i18n";

// 站点对外公网地址(与 base-url.ts 一致):优先 APP_URL,回退主域名。
// 回退用自定义主域名:robots.ts/sitemap.ts 在构建期生成、读不到运行时 APP_URL 时也能给出正确 canonical 域名。
export const SITE_URL = process.env.APP_URL?.replace(/\/$/, "") || "https://x2t.actionow.ai";
export const SITE_NAME = "X2T";

const COPY = {
  zh: {
    title: "X2T · 金融博主信号聚合 + AI 分析",
    description:
      "订阅 X(Twitter)、Reddit 等金融博主,第一时间获取交易信号、AI 中英双语分析、博主×标的立场图谱与共识。非投资建议。",
    keywords: ["金融博主", "交易信号", "股票信号", "AI 分析", "投资信号聚合", "fintwit", "X2T", "美股", "加密货币", "立场图谱", "博主共识"],
  },
  en: {
    title: "X2T · Financial Influencer Signals + AI Analysis",
    description:
      "Aggregate trading signals from financial influencers on X (Twitter) and Reddit, with bilingual AI analysis, influencer × ticker stance graphs and consensus. Not financial advice.",
    keywords: ["financial influencers", "trading signals", "stock signals", "AI analysis", "fintwit", "X2T", "stock market", "crypto", "stance graph", "consensus"],
  },
} as const;

function copy(locale: Locale) {
  return COPY[locale] ?? COPY.zh;
}

// 根布局元数据(随 locale 切换语言)。
export function siteMetadata(locale: Locale): Metadata {
  const c = copy(locale);
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: c.title, template: `%s · ${SITE_NAME}` },
    description: c.description,
    keywords: [...c.keywords],
    applicationName: SITE_NAME,
    // 注意:不在根布局设 canonical——否则会被全站子页继承,把 sitemap 里上千个博主/个股页
    // 都声明成首页副本、从索引合并掉。各页(首页 / /p / /i / /t)在自己的 generateMetadata 里设自身 canonical。
    // 仅声明 RSS autodiscovery(首页 head 里输出 <link rel=alternate type=application/rss+xml>)。
    alternates: { types: { "application/rss+xml": [{ url: "/rss/all", title: "X2T" }] } },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
    },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      url: SITE_URL,
      title: c.title,
      description: c.description,
      locale: locale === "zh" ? "zh_CN" : "en_US",
      images: [{ url: "/og.png", width: 1200, height: 630, alt: SITE_NAME }],
    },
    twitter: { card: "summary_large_image", title: c.title, description: c.description, images: ["/og.png"] },
    // Google Search Console 验证(配 GOOGLE_SITE_VERIFICATION 后自动注入 meta)
    verification: process.env.GOOGLE_SITE_VERIFICATION ? { google: process.env.GOOGLE_SITE_VERIFICATION } : undefined,
  };
}

const RSS_TYPES = { "application/rss+xml": [{ url: "/rss/all", title: SITE_NAME }] };

// 通用子页 metadata 收口:自指 canonical + og:url 自指 + 保留 RSS autodiscovery types。
// 统一堵住两类回归:① 漏 canonical(波C 漏了 /leaderboard /graph /about);
// ② 页面级 alternates 整体覆盖 layout 的 types → 丢 RSS link(/i /t /p)。各页一律走这里。
export function pageMetadata(opts: { path: string; title?: string; description?: string; ogType?: "website" | "article" | "profile"; noindex?: boolean; ogImage?: string }): Metadata {
  const img = opts.ogImage ?? "/og.png";
  const m: Metadata = { alternates: { canonical: opts.path, types: RSS_TYPES } };
  if (opts.title) m.title = opts.title;
  if (opts.description) m.description = opts.description;
  m.openGraph = {
    type: opts.ogType ?? "website",
    url: opts.path,
    ...(opts.title ? { title: opts.title } : {}),
    ...(opts.description ? { description: opts.description } : {}),
    images: [img],
  };
  if (opts.title || opts.description) {
    m.twitter = { card: "summary_large_image", ...(opts.title ? { title: opts.title } : {}), ...(opts.description ? { description: opts.description } : {}), images: [img] };
  }
  if (opts.noindex) m.robots = { index: false, follow: false };
  return m;
}

// 构建动态 OG 图 URL(/api/og 用 @napi-rs/canvas 原生渲染,根治 next/og 502)。文案走拉丁/数字,勿传 CJK(字体仅 latin 子集)。
export function ogImageUrl(spec: { brand: string; headline: string; sub?: string; accent?: "bull" | "bear" | "neutral"; sym?: string }): string {
  const p = new URLSearchParams();
  p.set("brand", spec.brand);
  p.set("h", spec.headline);
  if (spec.sub) p.set("sub", spec.sub);
  if (spec.accent && spec.accent !== "neutral") p.set("a", spec.accent);
  if (spec.sym) p.set("sym", spec.sym); // 个股页:OG 路由据此取"净立场 vs 价格"时序,嵌入迷你走势图
  return `/api/og?${p.toString()}`;
}

// 结构化数据:WebSite + Organization。
export function websiteJsonLd(locale: Locale) {
  const c = copy(locale);
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    alternateName: "X to Trade",
    url: SITE_URL,
    description: c.description,
    inLanguage: locale === "zh" ? "zh-CN" : "en",
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
      logo: { "@type": "ImageObject", url: `${SITE_URL}/icon-512.png`, width: 512, height: 512 },
    },
  };
}

// 帖子页结构化数据:社媒帖 + AI 摘要(Google 富结果资格)。
export function articleJsonLd(opts: { url: string; headline: string; description: string; datePublished: string; author: string; locale: Locale }) {
  return {
    "@context": "https://schema.org",
    "@type": "SocialMediaPosting",
    "@id": opts.url,
    url: opts.url,
    headline: opts.headline.slice(0, 110),
    description: opts.description,
    datePublished: opts.datePublished,
    inLanguage: opts.locale === "zh" ? "zh-CN" : "en",
    author: { "@type": "Person", name: opts.author },
    publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    isAccessibleForFree: true,
  };
}

// 博主页结构化数据:ProfilePage + Person(Google 2024 起支持 ProfilePage 富结果)。
export function profilePageJsonLd(opts: { url: string; handle: string; displayName: string | null; description: string; locale: Locale }) {
  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    url: opts.url,
    inLanguage: opts.locale === "zh" ? "zh-CN" : "en",
    mainEntity: { "@type": "Person", name: opts.displayName ?? opts.handle, alternateName: `@${opts.handle}`, description: opts.description },
  };
}

// 面包屑结构化数据。
export function breadcrumbJsonLd(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: it.url })),
  };
}
