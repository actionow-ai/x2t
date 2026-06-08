<div align="center">

<img src="public/og.png" alt="X2T — X to Trade" width="720" />

<h1>X2T · X to Trade</h1>

**聚合你关注的金融博主交易信号 —— 由 AI 结合实时行情分析,中英双语呈现。**

[![License: MIT](https://img.shields.io/badge/License-MIT-0c0c0c.svg)](LICENSE)
[![Next.js 15](https://img.shields.io/badge/Next.js-15-0c0c0c?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![PostgreSQL + Prisma](https://img.shields.io/badge/PostgreSQL-Prisma-4169E1?logo=postgresql&logoColor=white)](https://www.prisma.io)
[![DeepSeek V4](https://img.shields.io/badge/AI-DeepSeek%20V4-4d6bfe)](https://deepseek.com)
[![Live demo](https://img.shields.io/badge/demo-x2t.actionow.ai-c9f24a?labelColor=0c0c0c)](https://x2t.actionow.ai)

[**在线试用**](https://x2t.actionow.ai) · [English](README.md) · [简体中文](README.zh-CN.md) · [部署](DEPLOY.md)

</div>

---

## 概览

X2T 盯着你在 X(Twitter)、Reddit 等平台关注的金融博主。博主一发帖,X2T 立刻抓取,用 AI agent 结合实时行情做分析,产出中英双语摘要,绘制「博主 × 标的」立场图谱,并在有人立场转向时推送提醒。开源,可自托管。

> [!IMPORTANT]
> **非投资建议。** X2T 聚合的是公开帖子与公开市场数据,仅供参考,不构成任何买卖建议。

### 在线试用 —— 无需安装

公开试用站点:**[x2t.actionow.ai](https://x2t.actionow.ai)**。可直接在浏览器里浏览信号流与 AI 分析、查看立场图谱与个股共识、切换中英文、关注博主并开启推送,什么都不用装。

## 目录

- [功能](#功能)
- [工作原理](#工作原理)
- [技术栈](#技术栈)
- [快速开始](#快速开始)
- [配置](#配置)
- [部署](#部署)
- [项目结构](#项目结构)
- [脚本](#脚本)
- [贡献](#贡献)
- [许可证](#许可证)

## 功能

| | |
| --- | --- |
| **多源抓取** | 自建 RSSHub 网关(X / Reddit / StockTwits)、普通 RSS,或人工提交;按 `(博主, platformPostId)` 幂等去重。 |
| **结合行情的 AI 分析** | DeepSeek V4 agent 按**原文语种**分析每条帖子,抽取标的($代码 + 公司/产品名),逐标的拉取实时数据,判断博主观点与价格/新闻/情绪是一致还是背离,并做置信度校准。 |
| **原文 / 中文 / English** | 用更便宜的 flash 模型翻译每条帖子与分析;原语种槽保留 agent 自己的文字,所以每条都有三版可读。 |
| **可插拔行情数据** | Finnhub(行情/概况/新闻)、Exa(语义新闻)、Alpha Vantage(新闻情绪)。每个 provider 按 key 开关、自动降级;全不配则回退确定性 mock。 |
| **立场图谱** | 力导向的「博主→标的」图谱(d3-force):边按时效加权、转向标记、可拖动、全屏、点击节点看关联帖子。 |
| **共识与转向提醒** | 单标的的博主共识,加上立场转向检测,触发 web-push 推送。 |
| **账号与关注** | 邮箱魔法链接免密登录。登录后关注云端同步,匿名则存浏览器;首页按关注过滤。 |
| **双语 neo-brutalism UI** | 基于 cookie 的中英切换,刻意的「Tape」设计体系。 |
| **生产就绪** | 限流、管理员与密钥 fail-closed、复合索引、查询收敛 + 进程内缓存、worker 自愈、被墙头像 CDN 的图片代理,以及完整 SEO(metadata / sitemap / robots / JSON-LD / OpenGraph)与分析。 |

## 工作原理

```
 数据源 ──抓取──▶ Post(去重) ──分析──▶ AI agent ─┐
 RSSHub / RSS / 人工            DeepSeek V4-pro      │
                                                   ├─▶ 翻译 (V4-flash) ─▶ 中 / 英
   逐标的实时行情 ──────────────────────────────────┤
   Finnhub · Exa · Alpha Vantage                    │
                                                   └─▶ 立场图谱 · 共识 · 转向 ─▶ web-push
```

一个合并容器同时跑 Next.js Web 与后台 worker。worker 循环:抓取所有活跃源 → 清空分析队列(小并发池 + 单次超时)→ 检测转向并推送 → 清理过期缓存。

## 技术栈

![Next.js](https://img.shields.io/badge/Next.js%2015-0c0c0c?logo=next.js)
![React](https://img.shields.io/badge/React%2019-20232A?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?logo=prisma)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![d3](https://img.shields.io/badge/d3--force-F9A03C?logo=d3.js&logoColor=white)
![GSAP](https://img.shields.io/badge/GSAP-88CE02?logo=greensock&logoColor=black)

Next.js 15 App Router + React 19 + TypeScript · Prisma 6 + PostgreSQL · DeepSeek V4(走 OpenAI 兼容 SDK)· d3-force · GSAP · web-push(VAPID)· rss-parser · zod · 自建 RSSHub · Cloudflare Email Service 或 SMTP。以 web + worker 合并镜像部署于 Zeabur。

## 快速开始

前置:Node 20+、pnpm、Docker(本地起 Postgres + RSSHub)。

```bash
# 1. 起依赖 —— Postgres(55432)+ RSSHub(51200),端口非标准避让,免冲突
docker compose up -d db rsshub

# 2. 配置环境变量(首次)
cp .env.example .env
openssl rand -hex 32          # 把结果填进 AUTH_SECRET

# 3. 安装依赖 + 建表
pnpm install
pnpm db:push

# 4. 灌入示例博主源
pnpm db:seed

# 5. 启动 Web
pnpm dev                       # http://localhost:53000

# 6.(可选)另开终端跑后台 worker
pnpm worker                    # 抓取 -> 分析 -> 推送,循环
```

## 配置

所有集成遵循同一规则:**环境变量留空 → 自动降级为 mock;填上 → 立即变真。** 完整带注释清单见 [`.env.example`](.env.example),分组为:Postgres、应用地址、Google Analytics、抓取/轮询、RSSHub、web-push(VAPID)、LLM(OpenAI 兼容 / DeepSeek)、行情数据(Finnhub / Exa / Alpha Vantage)、账号 + 邮件、管理员白名单。

## 部署

X2T 以 web + worker 合并镜像交付,Postgres 与 RSSHub 作为兄弟服务。[Zeabur](https://zeabur.com) 分步说明见 **[DEPLOY.md](DEPLOY.md)**。

> **需要服务器?** 在 [**Zeabur**](https://zeabur.com) 购买,结账时填入推荐码 **`actionow.ai`** 立享 9 折。

## 项目结构

```
src/
  app/            # 路由:feed /、/graph、/following、/submit、/login、
                  #       /p/[id]、/i/[handle]、/t/[symbol]、/admin/*、/api/*
                  # 以及 icon.svg、favicon.ico、sitemap.ts、robots.ts
  components/      # PostCard、PostDetail、GraphCanvas、Avatar、FollowButton ...
  lib/
    connectors/   # 抓取源(rss、manual)
    llm/          # LLM provider(openai-compatible、mock)
    marketdata/   # finnhub、exa、alphavantage、fmp、mock + 带缓存的聚合器
    agent.ts      # 帖子分析管道
    translate.ts  # flash 翻译层
    stance.ts     # 共识、图谱数据、转向检测
    seo.ts、auth.ts、push.ts、ingest.ts、img.ts ...
scripts/          # worker.ts、poll.ts、analyze.ts、digest.ts、seed.ts、gen-logo.mjs
prisma/           # schema.prisma
```

## 脚本

| 命令 | 用途 |
| --- | --- |
| `pnpm dev` | Web 应用(端口 53000) |
| `pnpm worker` / `pnpm worker:once` | 后台循环 / 跑一轮(抓取 + 分析 + 推送) |
| `pnpm poll` · `pnpm analyze` | 仅抓取 / 仅分析 的循环 |
| `pnpm digest` | 发送每日邮件摘要 |
| `pnpm db:push` · `pnpm db:seed` · `pnpm db:studio` | Prisma 建表 / 灌种子 / studio |
| `node scripts/gen-logo.mjs` | 重新生成 logo、favicon、OpenGraph 图 |

## 贡献

欢迎 issue 与 PR。较大改动请先开 issue 讨论方向。提交前请跑 `pnpm lint` 与 `npx tsc --noEmit`。

## 许可证

[MIT](LICENSE) © actionow.ai

<div align="center">
<sub>Built with Next.js · 自托管于 Zeabur · 非投资建议</sub>
</div>
