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
    alternates: { canonical: "/" },
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
