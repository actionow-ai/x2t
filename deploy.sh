#!/usr/bin/env bash
# X2T 一键部署:Postgres + RSSHub + 应用(web+worker 合并容器)全部由 docker compose 拉起,
# 并完成建表与种子数据。重复执行安全:镜像重建、schema push、seed(upsert)均幂等。
# 一个 key 都不填也能跑(AI/行情自动降级为 mock);填真 key 见 .env 注释与 DEPLOY.md。
set -euo pipefail
cd "$(dirname "$0")"

command -v docker >/dev/null 2>&1 || { echo "✗ 需要 Docker:https://docs.docker.com/get-docker/"; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "✗ 需要 Docker Compose v2(docker compose 子命令)"; exit 1; }

# 1) 首次生成 .env,并写入随机 AUTH_SECRET(已有 .env 则不动)
if [ ! -f .env ]; then
  cp .env.example .env
  SECRET=$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')
  sed "s|^AUTH_SECRET=.*|AUTH_SECRET=${SECRET}|" .env > .env.tmp && mv .env.tmp .env
  echo "✓ 已生成 .env(含随机 AUTH_SECRET)。LLM/行情等 key 可稍后再填,留空先用 mock。"
fi

# 2) 构建并启动全栈(db + rsshub + app;app 容器内同时跑 web 与 worker)
docker compose --profile full up -d --build

# 3) 建表 + 种子(~24 个精选美股源,upsert 幂等)
docker compose run --rm app pnpm db:push
docker compose run --rm app pnpm db:seed

echo
echo "✓ X2T 已就绪 → http://localhost:53000"
echo "  变真实数据:编辑 .env 填 key,然后 docker compose --profile full up -d"
