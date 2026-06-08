import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // X2T — 金融博主信号聚合 + AI 分析平台
  // 容器化精简产物：构建出 .next/standalone，运行时只需 `node server.js`（见 Dockerfile）。
  output: "standalone",
};

export default nextConfig;
