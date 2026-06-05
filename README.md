# X2T · X to Trade

订阅你关注的股市金融博主（如 Serenity），博主发帖后第一时间抓取，由 AI Agent 结合多路外部数据分析并推送。开源 · Web · 美股。

> ⚠️ **非投资建议。** X2T 聚合的是博主的公开内容与公开市场数据，仅供参考，不构成任何买卖建议。

## 当前进度

正在建第一个切片 **「抓取 → 分析 → 推送」MVP**，内部里程碑：

- **M1 抓取 + 浏览**（进行中）：RSS 连接器 + 轮询去重入库 + 目录/feed/博主页 + 人工提交
- M2 订阅 + 推送 · M3 Agent 分析 · M4 图谱 + 时效性 · M5 账号层

完整设计见 [`docs/superpowers/specs/2026-06-05-x2t-signal-analysis-mvp-design.md`](docs/superpowers/specs/2026-06-05-x2t-signal-analysis-mvp-design.md)。

## 技术栈

Next.js (App Router) + TypeScript · Postgres + Prisma · 独立轮询/分析 Worker · Anthropic TS SDK（M3+）

## 本机开发

```bash
# 1. 起 Postgres（非标准端口 55432 避让，避免与其他项目冲突）
docker compose up -d db

# 2. 配置环境变量
cp .env.example .env

# 3. 安装依赖 + 建表
pnpm install
pnpm db:push

# 4. 灌入示例博主源
pnpm db:seed

# 5. 启动 Web（聚合 feed）
pnpm dev            # http://localhost:3000

# 6. 另开一个终端跑抓取 Worker
pnpm poll:once      # 抓一轮
pnpm poll           # 按 POLL_INTERVAL_MS 持续轮询

# 7. 分析 Worker（不填 key 用 mock；填 LLM_API_KEY 转真：OpenAI 官方 / DeepSeek 等）
pnpm analyze:once   # 分析一批 pending
pnpm analyze        # 持续分析
```

> **接真实 LLM（OpenAI 系列 / DeepSeek）**：在 `.env` 填 `LLM_API_KEY`；DeepSeek 另设 `LLM_BASE_URL=https://api.deepseek.com`、`LLM_MODEL=deepseek-chat`。行情接 Finnhub：填 `FINNHUB_API_KEY`。

## 架构（三带）

```
① 抓取入库  数据源 → 抓取连接器(可插拔) → 轮询Worker(去重) → Postgres
② 分析      Postgres + 外部数据(provider) + LLM → Agent Worker → post_analysis   (M3)
③ 浏览订阅  Postgres → Next.js → 浏览 / RSS / Web-Push / 登录 → 用户
```

两个可插拔接口：**抓取连接器**（RSS / 人工提交 / X-API）、**外部数据 provider**（Finnhub / Polygon / Yahoo）。
