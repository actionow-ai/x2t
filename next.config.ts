import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // X2T — 金融博主信号聚合 + AI 分析平台
  experimental: {
    // 服务端 actions / worker 共用 prisma，无需特殊配置
  },
};

export default nextConfig;
