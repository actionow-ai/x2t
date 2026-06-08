# syntax=docker/dockerfile:1
# X2T 多目标镜像：
#   --target app     精简 Next 运行时（standalone，node server.js）
#   --target worker  后台管道（抓取+分析），含全量依赖与 tsx
# docker-compose 用 build.target 分别构建（见 docker-compose.yml）。

FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
# openssl：Prisma 查询引擎运行时依赖
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable

# ---- deps：全量依赖 + 生成 Prisma Client ----
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile
RUN pnpm db:generate

# ---- builder：next build（standalone）----
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm db:generate && pnpm build

# ---- app：精简运行时 ----
FROM base AS app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]

# ---- worker：后台抓取+分析（tsx 跑 TS 脚本）----
FROM base AS worker
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY prisma ./prisma
COPY src ./src
COPY scripts ./scripts
# 默认常驻循环；cron 部署可覆盖为 `pnpm worker:once` / `pnpm digest`
CMD ["pnpm", "worker"]
