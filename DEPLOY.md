# 部署 · 让 X2T 真正可用

X2T 的所有 mock 都遵循同一规则：**对应环境变量留空 → 自动降级为 mock；填上 → 立即变真**。
所以「从演示到可用」基本是「填对几个 key + 起好抓取源」，无需改代码。

---

## 1. 哪些 key 让什么变真

| 你想要 | 在 `.env` 配置 | 不配时 |
| --- | --- | --- |
| 真实 AI 分析 | `LLM_API_KEY`（+ `LLM_BASE_URL` / `LLM_MODEL`）| mock：关键词占位分析 |
| 真实行情/外部数据 | `FINNHUB_API_KEY` | mock：随机占位行情 |
| 真实邮件（登录链接 + 摘要）| `CF_EMAIL_ACCOUNT_ID`+`CF_EMAIL_API_TOKEN`+`EMAIL_FROM`（Cloudflare Email Service），或传统 `SMTP_*` | 邮件打到控制台 |
| 安全的会话 | `AUTH_SECRET`（`openssl rand -hex 32`）| 不安全的默认值 |
| 限定管理员 | `ADMIN_EMAILS`（逗号分隔）| 任何登录用户都是管理员 |
| 真实抓取 X | 起 RSSHub + `TWITTER_AUTH_TOKEN` + `RSSHUB_BASE_URL` | 该源抓取失败（其余源不受影响）|

> LLM 推荐 DeepSeek（便宜）：`LLM_BASE_URL=https://api.deepseek.com`、`LLM_MODEL=deepseek-chat`。
> Finnhub 免费档即可起步。

---

## 2. 抓取数据源

抓取连接器是 RSS（`src/lib/connectors/rss.ts`），`sourceConfig` 两种写法：

- **`feedUrl`** —— 任意可直连的真实 RSS（财经新闻 / Substack / 博客）。开箱即用，无需 RSSHub。
  例：`{ "connector": "rss", "feedUrl": "https://feeds.marketwatch.com/marketwatch/topstories/" }`
- **`feedPath`** —— 经自建 RSSHub 解析（`RSSHUB_BASE_URL` + path）。用于 X / Reddit / StockTwits 等需登录或反爬的源。
  例：`{ "connector": "rss", "feedPath": "/twitter/user/serenity" }`

`feedPath` 把「源路由」与「RSSHub 实例地址」解耦：换实例只改 `RSSHUB_BASE_URL`，无需重新 seed。

### 自建 RSSHub 抓 X（本项目选定方案）

1. 起服务：`docker compose up -d rsshub`（宿主 `51200` → 容器 `1200`）。
2. X 抓取需 RSSHub 配置访问凭据 `TWITTER_AUTH_TOKEN`（compose 注入 RSSHub 容器）：请参照 [RSSHub 官方文档](https://docs.rsshub.app) 自行配置。**注意**：用账号凭据做自动化抓取可能违反第三方平台服务条款，请自行评估合规与账号风险，或优先选用 Substack / 新闻等授权语义更清晰的 RSS 源。
3. 应用侧把博主 `sourceConfig` 写成 `{ connector: "rss", feedPath: "/twitter/user/<handle>" }`（seed.ts 已示范）。
4. 验证：`curl http://localhost:51200/twitter/user/<handle>` 能返回 XML 即通。

RSSHub 同样支持 `/reddit/...`、`/stocktwits/...` 等大量路由（见 https://docs.rsshub.app）。注意：X 反爬严格，cookie 会过期、路由可能间歇失败 —— 这是该方案的固有风险，必要时考虑 X 官方 API（见 §5）。

---

## 3. 生产部署（docker compose）

> 一键完成本节全部步骤：仓库根目录执行 **`./deploy.sh`**（生成 .env + 随机 AUTH_SECRET → 构建启动全栈 → 建表 + 种子,幂等可重复执行）。下面是手动等价步骤。

镜像见 `Dockerfile`（**单一合并镜像**：一个容器内由进程监督脚本同时跑 web `next start` 与后台 worker，任一退出则整体退出让平台重启）。早期的「多目标 app/worker」方案因 zbpack 限制已废弃,详见下方踩坑。

```bash
# 0. 准备 .env（至少 AUTH_SECRET；要变真则填 LLM/Finnhub/SMTP/TWITTER_AUTH_TOKEN）
cp .env.example .env && openssl rand -hex 32   # 把输出填进 AUTH_SECRET

# 1. 构建并启动全栈（db + rsshub + app）；app 容器内同时跑 web 与 worker
docker compose --profile full up -d --build

# 2. 首次建表 + 灌种子（app 镜像含 prisma CLI 与脚本）
docker compose run --rm app pnpm db:push
docker compose run --rm app pnpm db:seed

# 3. 访问：app 在宿主 53000（建议挂到反向代理 + HTTPS）
```

> **单一合并镜像**：`Dockerfile` 构建的镜像在一个容器内同时跑 Next 网页与后台 worker（`CMD` 后台起 `pnpm worker`、前台起 `next start`）。这样无论 `docker compose` 还是 Zeabur，都只需部署「一个应用服务 + 一个数据库」。

- **HTTPS 必需**：Web-Push 与 Service Worker 只在 HTTPS（或 localhost）下工作。生产请在 app 前加 Nginx/Caddy/云负载均衡做 TLS。
- **数据库**：compose 内置 Postgres 适合自托管；也可用托管库（Neon/Supabase/RDS），把 `DATABASE_URL` 指过去即可（此时可不起 `db` 服务）。
- **每日摘要**：默认关。两种开法 —— 设 `WORKER_RUN_DIGEST=true`（app 容器内的 worker 按 `DIGEST_INTERVAL_MS` 跑），或用外部 cron：`docker compose run --rm app pnpm digest`。

### 本机开发（只起依赖）

`docker compose up -d db rsshub` 只起依赖；网页用 `pnpm dev`、后台用 `pnpm worker` 在宿主分开跑，便于热更新。合并的 `app` 服务挂在 `full` profile，默认不随 `docker compose up` 启动。

---

## 3b. Zeabur 部署（CLI · 本项目已上线）

本项目已用 Zeabur CLI 部署到自有服务器（AI-Gateway / 2C4G）。要点：

- **私有库 Zeabur 看不到** → app 用 `zeabur deploy`（本地上传，非 Git）。
- **zbpack 对存在的根 `Dockerfile` 一律使用、且忽略 `ZBPACK_DOCKERFILE_NAME` 等按服务选择** → 无法用两个 Dockerfile 区分两个服务，故采用「单一合并镜像」：一个服务、容器内同时跑 web+worker。
- 线上服务：**Postgres**（模板）+ **x2t-app**（合并镜像,含 web+worker）+ **RSSHub**（模板 X46PTP,内网专用,注入 `TWITTER_AUTH_TOKEN` 抓 X）+ Redis（RSSHub 缓存）。

```bash
# 1. 建项目（绑定到目标服务器 region）+ Postgres 模板
zeabur project create -n x2t -r <server-region-id>
zeabur template deploy -c B20CX0 --project-id <project-id>      # 官方 PostgreSQL

# 2. 部署 app（本地上传，自动用根 Dockerfile）
zeabur deploy --create --name x2t-app --project-id <project-id>

# 3. 注入变量（DATABASE_URL 用 Zeabur 引用变量；含 AUTH_SECRET/VAPID 等）
#    .env.zeabur.local 内含一行 DATABASE_URL=${POSTGRES_CONNECTION_STRING}
zeabur variable env -f .env.zeabur.local --id <app-service-id> --env-id <env-id>

# 4. 远程初始化库（用 Postgres 的【公网】连接串，从本机跑）
zeabur service instruction --id <postgres-id> --env-id <env-id>   # 取 Connection String
DATABASE_URL=<public-conn-str> pnpm db:push
DATABASE_URL=<public-conn-str> pnpm db:seed

# 5. 重新部署 app 让变量生效（本地上传服务用 deploy 重传，redeploy 仅限 Git 绑定）
zeabur deploy --service-id <app-service-id>

# 6. 开域名
zeabur domain create --domain <name> --id <app-service-id> --env-id <env-id> -g -y
```

> 更新部署：改完代码后 `zeabur deploy --service-id <app-service-id>` 重传重建即可。
> 改了 schema：先用公网连接串 `DATABASE_URL=... pnpm db:push`，再重部署 app。

---

## 4. 升级数据库结构

改了 `prisma/schema.prisma` 后：

```bash
pnpm db:push                                # 本机
docker compose run --rm app pnpm db:push    # 容器
```

> 注意：运行中的应用进程会缓存旧的 Prisma Client，改 enum/字段后需**重启 app/worker** 才生效。

---

## 5. 抓取的替代/兜底方案

- **X 官方 API v2**：最稳定（约 $100/月起，有限流）。在 `src/lib/connectors/` 加一个连接器（实现 `Connector.fetch`），在 `connectors/index.ts` 注册，博主 `sourceConfig.connector` 指向它。
- **人工提交**：`/submit` 表单已可用（`manual` 连接器），无需任何抓取设施即可录入。
- **第三方抓取**（如 Apify）：同样以新连接器形式接入，按量计费。

---

## 6. 上线安全清单

- [ ] `AUTH_SECRET` 为随机值（`openssl rand -hex 32`），且未提交（`.env` 已在 `.gitignore`）。
- [ ] `ADMIN_EMAILS` 设为真实管理员白名单（否则任何登录用户都是管理员）。
- [ ] app 置于 HTTPS 之后（Web-Push 必需）。
- [ ] 数据库口令非默认 `x2t:x2t`（自托管 Postgres 时改 compose 与 `DATABASE_URL`）。
- [ ] `TWITTER_AUTH_TOKEN` 等密钥仅在服务器 `.env`，不进版本库、不进日志。
