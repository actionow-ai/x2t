# X2T — X to Trade

[English](README.md) | **简体中文**

聚合你在 X(Twitter)、Reddit 等平台关注的金融博主的交易信号。博主一发帖,X2T 立刻抓取,用 AI 结合实时行情做分析,产出中英双语摘要,绘制「博主 × 标的」立场图谱,并在有人立场转向时推送提醒。

> **非投资建议。** X2T 聚合的是公开帖子与公开市场数据,仅供参考,不构成任何买卖建议。

> **在线试用 —— 无需安装:** **https://x2t.actionow.ai**
> 公开试用站点。可直接在浏览器里浏览信号流与 AI 分析、查看「博主×标的」立场图谱与个股共识、切换中英文、关注博主并开启推送。Zeabur 自托管(部署见 [DEPLOY.md](DEPLOY.md))。

---

## 它能做什么

- **多源抓取。** 经自建 RSSHub 网关(X / Reddit / StockTwits)、普通 RSS 或人工提交入库,按 `(博主, platformPostId)` 幂等去重。
- **结合行情的 AI 分析。** 每条帖子由 DeepSeek V4 agent 按**原文语种**分析:抽取标的($代码 + 公司/产品名),逐标的拉取实时外部数据,判断博主观点与当前价格/新闻/情绪是一致还是背离,并做置信度校准(证据不足则弃权为中性)。
- **原文 / 中文 / 英文 全覆盖。** 用更便宜的 flash 模型翻译每条帖子与分析;原语种槽保留 agent 自己的文字,所以每条都能以「源语种 + 中 + 英」三版阅读。
- **可插拔外部数据 + 自动降级。** Finnhub(行情 / 概况 / 公司新闻)、Exa(语义新闻)、Alpha Vantage(新闻情绪)。任一 provider 未配 key 即静默跳过;全部不配则回退到确定性 mock。
- **力导向立场图谱。** 「博主→标的」知识图谱(d3-force):边按时效加权、转向标记、可拖动重排、全屏、点击节点查看关联帖子。
- **共识与转向提醒。** 单标的的博主共识,加上立场转向检测,触发 web-push 推送。
- **账号与关注。** 邮箱魔法链接免密登录。登录后关注云端同步,匿名则存浏览器;首页信号流按你的关注过滤。
- **Web 推送。** VAPID web-push,推送新帖与立场转向。
- **中英双语 UI**,基于 cookie 的语言切换,neo-brutalism(Tape)设计。
- **管理后台**,管理博主源、帖子(删除 / 重新分析)与用户。
- **生产加固。** 内存限流、管理员与会话密钥 fail-closed、复合索引、图谱/共识查询收敛 + 进程内缓存、worker 自愈 + 过期缓存 GC。
- **SEO 与分析。** 随语言切换的 metadata、OpenGraph 分享图、`sitemap.xml`、`robots.txt`、JSON-LD,以及 Google Analytics。

## 工作原理

```
数据源 ──抓取──> Post(去重) ──分析──> AI agent ─┐
(RSSHub/RSS/人工)            (DeepSeek V4-pro)   │
                                               ├─> 翻译 (V4-flash) ─> 中 / 英
   逐标的外部数据 ─────────────────────────────>┤
   (Finnhub / Exa / Alpha Vantage)             │
                                               └─> 立场图谱 · 共识 · 转向 → web-push
```

一个合并容器同时跑 Next.js Web 与后台 worker。worker 循环:抓取所有活跃源 → 清空分析队列(小并发池 + 单次超时)→ 检测转向并推送 → 清理过期缓存。

## 技术栈

Next.js 15(App Router)+ React 19 + TypeScript · Prisma 6 + PostgreSQL · DeepSeek V4(走 OpenAI 兼容 SDK)· d3-force · GSAP · web-push(VAPID)· rss-parser · zod · 自建 RSSHub · Cloudflare Email Service 或 SMTP。部署于 Zeabur。

## 快速开始

前置:Node 20+、pnpm、Docker(本地起 Postgres + RSSHub)。

```bash
# 1. 起依赖:Postgres(55432)+ RSSHub(51200)—— 端口非标准避让,免与其它项目冲突
docker compose up -d db rsshub

# 2. 配置环境变量(首次)
cp .env.example .env
# 生成会话密钥填入 AUTH_SECRET:
openssl rand -hex 32

# 3. 安装依赖 + 建表
pnpm install
pnpm db:push

# 4. 灌入示例博主源
pnpm db:seed

# 5. 启动 Web
pnpm dev            # http://localhost:53000

# 6.(可选)另开一个终端跑后台 worker
pnpm worker         # 抓取 -> 分析 -> 推送,循环
```

## 配置

所有集成遵循同一规则:**对应环境变量留空 → 自动降级为 mock;填上 → 立即变真。** 完整清单见 [`.env.example`](.env.example),按区块分组:Postgres、应用地址、Google Analytics、抓取/轮询、RSSHub、web-push(VAPID)、LLM(OpenAI 兼容 / DeepSeek)、行情数据(Finnhub / Exa / Alpha Vantage)、账号 + 邮件、管理员白名单。

## 项目结构

```
src/
  app/            # 路由:feed /、/graph、/following、/submit、/login、
                  #       /p/[id]、/i/[handle]、/t/[symbol]、/admin/*、/api/*
                  # 以及 icon.svg、favicon.ico、sitemap.ts、robots.ts
  components/      # PostCard、PostDetail、GraphCanvas、FollowButton ...
  lib/
    connectors/   # 抓取源(rss、manual)
    llm/          # LLM provider(openai-compatible、mock)
    marketdata/   # finnhub、exa、alphavantage、fmp、mock + 带缓存的聚合器
    agent.ts      # 帖子分析管道
    translate.ts  # flash 翻译层
    stance.ts     # 共识、图谱数据、转向检测
    seo.ts、auth.ts、push.ts、ingest.ts ...
scripts/          # worker.ts、poll.ts、analyze.ts、digest.ts、seed.ts、gen-logo.mjs
prisma/           # schema.prisma
```

## 脚本

| 命令 | 用途 |
| --- | --- |
| `pnpm dev` | Web 应用(端口 53000) |
| `pnpm worker` | 后台循环:抓取 + 分析 + 推送 |
| `pnpm worker:once` | 跑一轮退出(配外部 cron) |
| `pnpm poll` / `pnpm analyze` | 仅抓取 / 仅分析 的循环 |
| `pnpm digest` | 发送每日邮件摘要 |
| `pnpm db:push` / `pnpm db:seed` / `pnpm db:studio` | Prisma 建表 / 灌种子 / studio |
| `node scripts/gen-logo.mjs` | 重新生成 logo、favicon、OG 图 |

## 部署

X2T 为 [Zeabur](https://zeabur.com) 而建:web + worker 合并镜像,Postgres 与 RSSHub 作为兄弟服务。分步说明见 [DEPLOY.md](DEPLOY.md)。

> **需要服务器?** 在 **https://zeabur.com** 购买,结账时填入推荐码 **`actionow.ai`** 立享 9 折。

## 许可证

暂无 LICENSE 文件 —— 对外分发前请添加(推荐 MIT)。
