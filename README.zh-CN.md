<div align="center">

<img src="public/og.png" alt="X2T — X to Trade" width="720" />

<h1>X2T · X to Trade</h1>

**追踪你关注的金融博主到底在说什么 —— 每条帖子由 AI 读成对个股的看多/看空判断,并用他们真实的历史战绩打分,中英双语呈现。**

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

X2T 盯着你在 X(Twitter)、Reddit、新闻/Substack 上关注的金融博主。博主一发帖,X2T 立刻抓取,用 AI agent 结合实时行情,把每条帖子读成对个股的看多/看空/中性判断,并产出中英双语摘要。再把这些判断聚合成个股**共识**、**多空辩论**、「博主 × 标的」**立场图谱**,以及别家没有的那一块 —— 诚实的**历史战绩**:跟随每个博主到底有没有跑赢大盘?有人立场转向时,第一时间推送给你。开源,可自托管。

> [!IMPORTANT]
> **非投资建议。** X2T 聚合的是公开帖子与公开市场数据,仅供参考,不构成任何买卖建议。

### 在线试用 —— 无需安装

公开试用站点 **[x2t.actionow.ai](https://x2t.actionow.ai)**,内置约 24 个精选美股源。可直接在浏览器浏览信号流与 AI 分析、打开战绩榜、查看立场图谱与个股共识+辩论、切换中英文、关注博主、点赞分享 —— 什么都不用装。

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
| **多源抓取** | 自建 RSSHub 网关(X / Reddit)、可直连 RSS(新闻 / Substack)、或手动提交。开箱内置约 24 个精选美股源。按 `(博主, platformPostId)` 幂等去重。 |
| **结合行情的 AI 分析** | DeepSeek V4 agent 用帖子原始语种分析,抽取标的(cashtag + 公司/产品/A股名),按标的拉实时数据,判断博主观点与价格/消息/情绪是一致还是背离 —— 并**校准置信度**:喊单、反讽、细价股炒作、转发新闻一律**不当**高置信判断。 |
| **历史战绩 —— 护城河** | 每条多空判断按**同期 SPY** 在 5 个交易日后回测。每位博主给出**「跑赢大盘」率** + **Wilson 95% 置信区间** + 样本门槛(杜绝「20 条样本 50%」式的误导)。**战绩榜**用 **Benjamini–Hochberg FDR** 多重比较校正排名(榜首不是运气),外加**「如果跟单」权益曲线**。 |
| **立场轨迹** | 每位博主的立场账本(对各标的的最新立场 + 转向标记)、立场翻转检测,以及首页仪表盘上的「近期转向」看板。 |
| **共识与辩论** | 个股跨博主共识(每人一票、取最新立场、小样本会标注)、从真实 rationale 派生的 **Bull vs Bear 多空辩论视图**(多头论据 / 空头论据 / 分歧点),以及 d3-force「博主 ↔ 标的」**立场图谱**(边按新近度加权、转向标记、缩放、全屏、读屏文本)。新闻搬运号会被标注,避免「共识」被头条稀释。 |
| **告警与摘要** | 可组合**告警规则**(如:*某股 看多博主 ≥N 且 出现翻转 → 推送*)、按博主的翻转推送、以及 opt-in 的**每日邮件摘要**(头部突出立场转向)。通知治理:按 (帖×订阅) 去重、冷却、日上限、静音时段。 |
| **结构化 RSS** | 每条 feed 带机读字段 `x2t:stance / confidence / divergence / ticker`;独立的 **`/rss/flips`** 立场转向事件流(带 `x2t:flip`);可组合 `?sig=1` / `?conf=0.7` 过滤,供量化/看板消费。 |
| **社交** | 赞 / 踩 带计数(匿名也可),一键**分享图卡** —— 客户端 `<canvas>` 渲染的 neo-brutalist 卡片 + 一键发 X。 |
| **账号** | 免密**邮箱验证码**登录(6 位 OTP,不发链接)。登录后关注列表云同步,未登录则浏览器本地存;信号流默认「信号优先」压住中性新闻噪音。 |
| **双语 · 响应式 UI** | Cookie 中英切换、帖子三版本(原文 / 中文 / English)、刻意的 neo-brutalist *Tape* 设计语言、PC 多栏 / 移动单栏 + 抽屉导航。 |
| **生产级加固** | Redis 可选限流、admin 与密钥 fail-closed、HMAC 会话带撤销、SSRF 防护的图片代理与价格抓取、CSP、复合索引 + 有界缓存查询、自愈 worker、完整 SEO(metadata / sitemap / robots / JSON-LD / OpenGraph)与分析。 |

## 工作原理

```
 数据源 ──抓取──▶ Post(去重)──分析──▶ AI agent ──┬─▶ 翻译(V4-flash)─▶ 中文 / English
 RSSHub / RSS / 手动            DeepSeek V4-pro       │
                                                    ├─▶ 立场图谱 · 共识 · 辩论
   按标的拉实时行情 ────────────────────────────────┤
   Finnhub · Exa · Alpha Vantage                    ├─▶ 转向检测 ─▶ web-push + 告警规则
                                                    │
   每日价格回填(Yahoo / Stooq)─▶ PriceDaily ──────┴─▶ 跑赢大盘率 · 战绩榜 · 权益曲线
```

单个合并镜像同时跑 Next.js Web 与后台 worker。worker 每几分钟一轮:**抓取**所有 active 源 → **分析** pending 队列(小并发池 + 单次超时)→ **检测转向**并推送 + 评估告警规则 → **回填价格**(每日,供战绩回测)→ **GC** 过期缓存 → **摘要**(可选)。统计(Wilson 区间、bootstrap、Benjamini–Hochberg FDR)在零依赖的 `stats.ts` 里算。

## 技术栈

![Next.js](https://img.shields.io/badge/Next.js%2015-0c0c0c?logo=next.js)
![React](https://img.shields.io/badge/React%2019-20232A?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?logo=prisma)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![d3](https://img.shields.io/badge/d3--force-F9A03C?logo=d3.js&logoColor=white)
![GSAP](https://img.shields.io/badge/GSAP-88CE02?logo=greensock&logoColor=black)

Next.js 15 App Router + React 19 + TypeScript · Prisma 6 + PostgreSQL · DeepSeek V4(经 OpenAI 兼容 SDK)· d3-force · GSAP · web-push(VAPID)· rss-parser · zod · Vitest · 自建 RSSHub · Redis(可选,跨实例限流)· Cloudflare Email Service 或 SMTP · 免费每日价格来自 Yahoo Finance / Stooq。以合并 web + worker 镜像跑在 Zeabur。

## 快速开始

前置:Node 20+、pnpm、Docker(本地 Postgres + RSSHub)。

```bash
# 1. 起依赖 —— Postgres(55432)+ RSSHub(51200),非标准端口避让冲突
docker compose up -d db rsshub

# 2. 配置环境(首次)
cp .env.example .env
openssl rand -hex 32          # 把结果填进 AUTH_SECRET

# 3. 装依赖 + 建表
pnpm install
pnpm db:push

# 4. 灌示例博主源(约 24 个精选美股账号)
pnpm db:seed

# 5. 起 Web
pnpm dev                       # http://localhost:53000

# 6.(可选)另开终端跑后台 worker
pnpm worker                    # 抓取 -> 分析 -> 转向/告警 -> 价格,循环
```

一个 key 都不填时,agent 用确定性 mock 行情,整站照样可浏览 —— 每个集成都是按需开启。

## 配置

每个集成只有一条规则:**env 留空就降级到 mock;填上就走真实。** 完整带注释列表见 [`.env.example`](.env.example),分组:Postgres、应用 URL、Google Analytics、抓取/轮询、RSSHub、web-push(VAPID)、LLM(OpenAI 兼容 / DeepSeek)、市场数据(Finnhub / Exa / Alpha Vantage)、账号 + 邮件、限流 Redis、每日摘要/告警开关、admin 白名单。几个值得一提的可选项:`REDIS_URL`(跨实例限流)、`WORKER_RUN_DIGEST` + 邮件 provider(真正发摘要)、`PUSH_COOLDOWN_MINUTES` / `QUIET_HOURS_UTC`(通知治理)、`WINRATE_SHOW_SAMPLES`(战绩展示门槛)。

## 部署

X2T 以合并 web + worker 镜像发布,Postgres 与 RSSHub 作为兄弟服务。[Zeabur](https://zeabur.com) 的分步指南见 **[DEPLOY.md](DEPLOY.md)**。

> **需要服务器?** 在 [**Zeabur**](https://zeabur.com) 下单,结账时填邀请码 **`actionow.ai`** 享 9 折。

## 项目结构

```
src/
  app/             # 路由:信号流 /、/graph、/leaderboard、/alerts、/following、
                   #       /submit、/login、/p/[id]、/i/[handle]、/t/[symbol]、
                   #       /about /terms /privacy、/rss/all、/rss/flips、/admin/*、/api/*
                   # 另含 icon.svg、favicon.ico、sitemap.ts、robots.ts
  components/       # PostCard、PostDetail、Reactions、ShareButton、GraphCanvas、
                    # EquitySparkline、NavTabs(抽屉)、Avatar、FollowButton ...
  lib/
    connectors/    # 抓取源(rss、manual)
    llm/           # LLM provider(openai 兼容、mock)
    marketdata/    # finnhub、exa、alphavantage、fmp、mock + 缓存聚合器
    agent.ts       # 帖子分析管道(标的抽取 + 结合行情的立场判断)
    stance.ts      # 共识、图谱、转向、账本、跑赢大盘率、战绩榜、辩论
    stats.ts       # 零依赖 Wilson 区间 / bootstrap / Benjamini-Hochberg FDR
    prices.ts      # 每日价格回填(Yahoo / Stooq),供回测
    alerts.ts      # 可组合 AND/OR 告警规则评估
    translate.ts · push.ts · ingest.ts · auth.ts · reactions.ts · digest.ts · img.ts · seo.ts ...
scripts/           # worker.ts、poll.ts、analyze.ts、digest.ts、seed.ts、gen-logo.mjs
prisma/            # schema.prisma
```

## 脚本

| 命令 | 用途 |
| --- | --- |
| `pnpm dev` | Web(端口 53000) |
| `pnpm worker` / `pnpm worker:once` | 后台循环 / 单次(抓取 + 分析 + 转向/告警 + 价格) |
| `pnpm poll` · `pnpm analyze` | 仅抓取 / 仅分析循环 |
| `pnpm digest` | 发每日邮件摘要 |
| `pnpm test` | Vitest 单元测试 |
| `pnpm db:push` · `pnpm db:seed` · `pnpm db:studio` | Prisma 建表 / 灌种 / studio |
| `node scripts/gen-logo.mjs` | 重新生成 logo、favicon、OpenGraph 图 |

## 贡献

欢迎 Issue 与 PR。较大改动请先开 Issue 讨论方向。提交前跑 `npx tsc --noEmit` 与 `pnpm test`;CI 每次 push 都会跑这两项。

## 许可证

[MIT](LICENSE) © actionow.ai

<div align="center">
<sub>Built with Next.js · 自托管于 Zeabur · 非投资建议</sub>
</div>
