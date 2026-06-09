import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // X2T — 金融博主信号聚合 + AI 分析平台
  // 单一镜像内同时跑 web 与 worker（见 Dockerfile），用 `next start` 启动，无需 standalone。
  // 2C4G 服务器构建省内存：跳过 next build 内置 lint/类型检查（已用 `tsc --noEmit` 单独把关），
  // 否则类型检查阶段易 OOM 导致构建失败。
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  // 基线安全响应头 + CSP。
  // 注:站内有 GA/JSON-LD 内联脚本,故 script-src 暂含 'unsafe-inline'(严格 nonce 需 middleware 改造,后续再上);
  // 但 frame-ancestors/object-src/base-uri/form-action 等硬约束已能挡点击劫持/对象注入/base 篡改。
  async headers() {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self' https://www.google-analytics.com https://*.google-analytics.com https://www.googletagmanager.com",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join("; ");
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },
};

export default nextConfig;
