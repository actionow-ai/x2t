import Script from "next/script";

// Google Analytics (gtag.js)。measurement id 走 NEXT_PUBLIC_GA_ID，默认用线上配置的 G-6JQKNSVGXM。
// 仅生产环境注入，避免本地开发污染分析数据。
const GA_ID = process.env.NEXT_PUBLIC_GA_ID || "G-6JQKNSVGXM";

export function GoogleAnalytics() {
  if (process.env.NODE_ENV !== "production" || !GA_ID) return null;
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
      <Script id="ga-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_ID}');`}
      </Script>
    </>
  );
}
