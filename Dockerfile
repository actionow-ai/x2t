# syntax=docker/dockerfile:1
# X2T 单一镜像：同一容器内同时跑 Next 网页与后台 worker（抓取+分析）。
# 说明：Zeabur/zbpack 对存在的根 Dockerfile 会直接使用、且忽略 ZBPACK_DOCKERFILE_NAME 之类按服务选择，
# 无法稳定地用两个 Dockerfile 区分两个服务；故合并为一个镜像、一个服务，容器内同时起两进程。

FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates bash \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable

# ---- deps：全量依赖 + Prisma Client ----
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile
RUN pnpm db:generate

# ---- run：构建 Next，并保留全量依赖/源码/脚本（worker 经 tsx 运行）----
FROM deps AS run
COPY . .
RUN pnpm build
ENV NODE_ENV=production PORT=8080 HOSTNAME=0.0.0.0
EXPOSE 8080
# 同容器内跑 worker + web;任一进程退出即整体退出(exit 1)→ Zeabur 重启容器,
# 避免 worker 静默崩溃后只剩 web 存活、抓取/分析停摆而容器仍 RUNNING。
CMD ["bash", "-c", "pnpm worker & w=$!; pnpm start & s=$!; wait -n; echo '[entrypoint] a child exited — stopping container to trigger restart'; kill $w $s 2>/dev/null; exit 1"]
