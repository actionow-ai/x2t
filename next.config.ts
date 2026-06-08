import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // X2T — 金融博主信号聚合 + AI 分析平台
  // 单一镜像内同时跑 web 与 worker（见 Dockerfile），用 `next start` 启动，无需 standalone。
  // 2C4G 服务器构建省内存：跳过 next build 内置 lint/类型检查（已用 `tsc --noEmit` 单独把关），
  // 否则类型检查阶段易 OOM 导致构建失败。
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
