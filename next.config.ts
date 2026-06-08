import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // X2T — 金融博主信号聚合 + AI 分析平台
  // 单一镜像内同时跑 web 与 worker（见 Dockerfile），用 `next start` 启动，无需 standalone。
};

export default nextConfig;
