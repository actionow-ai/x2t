# X2T · 信号 + 分析 MVP 设计文档

- **日期**：2026-06-05
- **状态**：设计定稿（待 DRI 审阅）
- **项目**：X2T（X to Trade）—— 金融博主信号聚合 + AI 分析平台
- **本文范围**：第一个交付切片「抓取 → 分析 → 推送」（合并版 MVP）
- **建造方式**：纯 vibecoding（见 §16，DRI 明确决定）

---

## 1 · 背景 & 目标

X2T 让用户订阅关注的股市金融博主（如美股博主 Serenity），在博主发帖后第一时间拿到内容，由 AI Agent 结合帖子 + 多路外部数据做分析并推送；未来还会有博主战绩排行榜、交易跳转。

**三个并列目标（决定一切设计取舍）：**

1. **开源** —— 透明、可自托管、易贡献。
2. **病毒传播** —— 在小红书 / X 上做出讨论量；每个分析卡片 / 图谱都是可分享物料。
3. **Web 平台** —— 浏览器即用。

**目标市场：美股**（DRI 决定）。数据源成熟（Finnhub / Polygon / Yahoo 免费档够 MVP）；券商深链只能跳到个股下单页（不替用户成交，反而合规友好）；"建议入场金额"最敏感，留到最后切片。

---

## 2 · 范围

### 本切片做（IN）
完整的「抓取 → 分析 → 浏览 / 订阅 / 推送」闭环：

- 博主源管理 + 可插拔抓取（默认 RSS）+ 人工提交
- 近实时轮询入库（几分钟级，去重）
- **完整 Agent 分析**：帖子文本 + 外部数据（行情 / 新闻 / 财报…）→ ticker / 方向 / 摘要 / 要点 / 置信度
- 在线浏览：目录 / 聚合 feed / 博主页 / 自定义组合
- 关系图谱视图（股票枢纽 / 帖子枢纽 / 全景）
- 时效性：立场时间线 + 转向检测
- 订阅 + 推送：RSS 输出 + web-push + 可选 magic-link 登录（云同步关注 + 邮件摘要）
- 合规免责声明贯穿全程

### 本切片不做（留给后续切片）
- **博主战绩排行榜**（准确率 / 收益打分）—— 下一切片
- **交易跳转 deeplink + 入场金额建议** —— 最后切片（合规最敏感）

### 迭代全景
原始四切片顺序经 DRI 调整为 `2 → 3 → 1 → 4`，并将前两个（信号流基座 + AI 分析）**合并**为本 MVP。后续：战绩排行榜 → 交易跳转。

---

## 3 · 关键决策记录（ADR 摘要）

| # | 决策 | 取舍 |
|---|---|---|
| D1 | 市场 = **美股** | 数据成熟、面向全球/华人；A股荐股需牌照故排除 |
| D2 | 产品重心 = 抓取+分析+推送闭环（**合并** Agent 进首发） | 首发即有 AI 差异化，非纯搬运；代价是本切片变重 |
| D3 | 抓取 = **可插拔连接器**，默认 RSS（RSSHub/Nitter）+ 人工提交，X-API 自带 key 适配器 | 开源友好、免费可跑、近实时；RSS 桥接对 X 封锁脆弱 |
| D4 | 账号 = **两者都要**：account-less + RSS 为核心地基，magic-link 登录为叠加可选层 | 零摩擦入口 + 留存/邮件；登录态是匿名态的严格超集 |
| D5 | 技术栈 = **Next.js / TypeScript 全栈** | 最大开源 web 贡献者池、前端最易出圈、AI 用 Anthropic TS SDK |
| D6 | 外部数据 = **可插拔 provider 接口** | Agent 不绑死单一数据源，按可得性展示 |
| D7 | 建造 = **纯 vibecoding**（见 §16） | DRI 明确豁免团队 SOP 不可妥协 #1，仅限本项目 |

---

## 4 · 系统架构

数据的一生分三条带子，**Postgres 是贯穿三带的枢纽**：

```
① 抓取入库
   数据源(X账号/人工提交) → 抓取连接器(可插拔) → 轮询Worker(去重) → Postgres

② 分析
   Postgres(新帖) + 外部数据(行情/新闻/财报 provider) + LLM(Anthropic·带缓存)
     → 🤖 Agent 分析 Worker → post_analysis 回写 Postgres

③ 浏览·订阅·推送
   Postgres(posts+analysis) → Next.js Web App
     → 浏览 / RSS 生成 / Web-Push / 可选登录(同步关注+邮件) → 用户
```

**两个独立进程的 Worker**（自托管 = `app + worker + Postgres`，MVP 不引入 Redis）：
- **轮询 Worker**：定时跑各 active 博主的连接器，规范化 + 去重 + 触发后续。
- **Agent 分析 Worker**：消费 `analysis_status=pending` 的帖子，拉外部数据 + 调 LLM，写 `post_analysis`。

**两个可插拔接口**（各自可独立测试、社区可贡献）：
- **抓取连接器接口**：`fetch(source_config) → 规范化帖子[]`。实现：RSS 适配器（默认）、人工提交适配器、X-API 适配器（自带 key，后续）。
- **外部数据 provider 接口**：`getQuote/getNews/getFinancials(symbol) → 标准结构`。实现：Finnhub / Polygon / Yahoo…，可跨 provider 降级。

---

## 5 · 数据模型

### 内容核心
- **influencers**：`id(PK)` · handle · platform · display_name · avatar · `source_config(JSON: 连接器+feed)` · active
- **posts**：`id(PK)` · `influencer_id(FK)` · **`platform_post_id` UNIQUE（去重键）** · url · content_text · posted_at · fetched_at · **`analysis_status`(pending/done/failed)**
- **post_analysis**：`id(PK)` · `post_id(FK, 1:1)` · summary · key_points(JSON) · overall_stance · confidence · model
- **post_tickers**（边表，posts ∞:∞ securities）：`post_id(FK)` · `symbol(FK)` · **stance（看多/看空/中性）** · rationale
- **securities**：`symbol(PK)` · name · exchange · asset_type · 板块
- **external_data_cache**：`id(PK)` · `symbol(FK)` · data_type(行情/新闻/财报…) · payload(JSON) · fetched_at · **expires_at（TTL 控成本）**

### 用户 · 订阅 · 推送
- **users**：`id(PK)` · `email UNIQUE` · created_at（magic-link，无密码）
- **follows**（users ∞:∞ influencers）：`user_id(FK)` · `influencer_id(FK)` · created_at
- **push_subscriptions**：`id(PK)` · `endpoint UNIQUE` · keys · **`user_id(FK, 可空 = 匿名也能订阅)`** · `follow_filter(JSON)`
- **deliveries**（防重复推送）：`(post_id × subscription)` 去重 · channel · status · sent_at
- **magic_links**：token · email · expires · used

**派生视图**（可物化以加速图谱/共识/转向，亦可即时计算）：
- **influencer_ticker_stance**：(influencer, symbol) → 当前立场（时间窗内最新一条）+ 上一条立场 + changed_at + 历史计数。用于转向检测和共识。

**关键约束**：
- 关注的双轨：匿名存浏览器本地 + 镜像到 `push_subscriptions.follow_filter`；登录写 `follows` 云同步。
- `analysis_status` 状态机驱动 Agent Worker，失败可重试。
- 每帖是**带时间戳的立场快照，历史不覆盖**（时效性逻辑的基础）。

---

## 6 · 时效性 & 立场逻辑

同一博主一天可多次发帖、对同一只票翻多翻空。规则：

1. **每帖 = 带时间戳的立场快照**，原始全保留，不覆盖历史。
2. **派生「博主×股票 当前立场」= 时间窗内最新一条**；图谱 / 共识里**每个博主只按最新立场计一次**（日内多帖不重复计数）。
3. **转向检测**：与该博主对该票的上一条立场不同 → 标 `⇄`，并作为一种**独立推送事件「立场转向」**。
4. **时效性分级**：🟢 新鲜 / 🟠 渐旧 / ⚪ 过期；UI 新鲜高亮、旧的淡化；共识默认只算时间窗内（近 24h / 7d 可切，过期不计入）。
5. **feed** 里日内多帖各自成卡；**博主页**可把同一只票当日多帖折叠成「立场时间线」。

---

## 7 · UI / 关键界面

所有分析向界面底部都带 **「非投资建议」** 免责声明。

- **聚合 feed —— 富卡片（风格 B，DRI 选定）**：每帖一张大卡 = 独立截图分享物料。头像/博主 + 原文 + 「🤖 AI 分析」框（方向徽章 + 置信度 + 摘要 + 要点）+ 行情 + 分享 + 免责。出圈优先。
- **帖子详情页**（可分享 URL）：原帖全文 + 整体方向/置信度/生成时间 + 摘要 + **每只标的一张卡片**（方向 + 理由 + **7 类外部数据**）+ 关键要点 + 免责。
  - **7 类外部数据**（织入每张标的卡，缺失字段自动隐藏）：① 行情（现价/盘前/量比）② 估值（市值/PE/营收YoY/毛利率）③ 分析师（共识评级 + 平均目标价 vs 博主目标价）④ 催化剂（下次财报日 + 倒计时）⑤ 新闻 ⑥ 资金面（机构增减持 / 内部人）⑦ 近期表现（1/5/20 日，也为战绩切片埋点）。
- **关系图谱**（跑在 `post_tickers` 边上，不加新表；力导向图组件如 react-force-graph / cytoscape）：① 股票枢纽（一只票 ← 多博主，看共识与分歧）② 帖子枢纽（一帖 → 多票）③ 全景二分网络。绿边看多 / 红边看空；点节点重新聚焦；可按时间窗过滤；后续接战绩后给边加权。
- **立场时间线**：博主×股票 当日多帖的立场演化 + 转向标记 + 时效性。
- **博主目录 + 博主页**：目录（搜索"谁在聊 $NVDA" + 排序，**战绩排名标"即将上线"**）+ 博主页头部（bio + 关注 + RSS + X主页 + 活跃度摘要 + 当前立场分布）。**本切片不显示准确率**（留给排行榜切片）。

---

## 8 · 推送 & 订阅机制

**RSS 输出（三种 feed）**：单博主 `/i/{handle}/rss`；自定义组合 `/rss?influencers=…` 或 `/rss?tickers=…`；全站 `/rss/all`。item 含博主 / 原文摘要 / AI 一句话分析 + 方向 / 回源链接。

**Web-Push（VAPID）+ 两类事件**：
- 事件 ①「关注博主发新帖」② 「立场转向」。
- 匿名按 `follow_filter` 推，登录按 `follows` 推；`deliveries` 去重。

**推送时机 ↔ Agent**：新帖入库 → pending → Agent 分析 → done → 推「新帖（含分析）」；**分析超时（>60s）或失败 → 先推原帖**，分析补齐后静默更新页面（不二次打扰）；「转向」在 stance 定下后判定再推。

**邮件（登录用户）**：MVP 只做每日 / 每周**摘要**，即时性靠 web-push。

---

## 9 · 错误处理 & 可靠性

- **抓取层**：RSS 实例失败/被封 → 退避重试 + 切备用实例/适配器；连续失败标 `unhealthy` 并在 UI 显示源健康；`platform_post_id` UNIQUE upsert 防重复。
- **Agent / 外部数据层**：provider 失败/限流 → 退避 + 跨 provider 降级，缺失字段照常分析并隐藏；LLM 失败/超时 → 重试 N 次（可配置，默认 3）→ 标 `failed` 可重试；**feed 永远先显示原帖，分析不阻塞浏览**。
- **成本控制**：`external_data_cache` TTL 复用 + LLM **prompt caching** + 每帖分析幂等 + 每日预算上限/限流。
- **结构化输出**：Agent 强制产出受 schema 约束的结构（ticker/stance/confidence/summary/key_points），不合规则重试。
- **推送层**：web-push 端点过期（404/410）→ 清理；邮件退信 → 标记停发。
- **幂等**：各 Worker 靠去重键 + `analysis_status` 状态机，崩溃重启不丢不重。

---

## 10 · 合规

- 定位 = **博主公开内容的聚合 + 对公开信息的客观摘要**，**非投资建议**。
- 仅镜像公开内容，每条帖子 / 分析**标注来源并回链原帖**。
- Agent 输出措辞为「客观摘要 + 来源标注」，不输出买卖指令。
- 行情/财报数据标注"可能延迟，以官方为准"。
- **战绩打分 / 交易撮合 / 入场金额** 全部不在本切片。

---

## 11 · 技术栈

- **全栈**：Next.js（App Router）+ TypeScript
- **DB**：Postgres（Prisma 或 Drizzle ORM）
- **Worker**：独立 Node 进程（轮询 + Agent 分析）；调度用内置 cron / node-cron，MVP 不引入 Redis
- **抓取**：RSS 解析（rss-parser 等）；连接器接口多 endpoint
- **AI**：Anthropic TypeScript SDK，**默认带 prompt caching**；结构化输出（tool/schema 约束）
- **外部数据**：Finnhub / Polygon / Yahoo 等 provider 适配器
- **推送**：web-push（VAPID）；邮件 nodemailer + provider
- **图谱**：react-force-graph / cytoscape
- **部署**：Docker 化，自托管 = app + worker + Postgres

---

## 12 · 测试策略

- **连接器**：录制 RSS fixtures（golden files），含畸形 / 空 / 重复。
- **去重幂等**：重复跑轮询不产生重复帖 / 重复推送。
- **Agent**：固定帖子样本 + mock 外部数据，断言结构化输出 schema；ticker/stance 抽取回归样本集。
- **时效性逻辑**：当前立场 = 窗口内最新 / 转向检测 / 共识每博主只计一次。
- **RSS 输出**：feed XML 合法性 + 必要字段。
- **E2E**：关注博主(匿名) → 入库 → 分析 → feed/详情/图谱出现 + web-push 触发(mock)。

---

## 13 · 范围 / 内部里程碑（增量交付，每步都有能跑的系统）

| 里程碑 | 交付 | 产物 |
|---|---|---|
| **M1 抓取+浏览** | RSS 连接器 + 轮询 + 去重入库 + 目录/feed/博主页（原帖无分析）+ 人工提交 | 可上线的"金融博主聚合阅读器" |
| **M2 订阅+推送** | RSS 输出 + web-push(匿名) + 本地关注 +「新帖」事件 | 第一时间收到关注博主新帖 |
| **M3 Agent 分析** | 外部数据 provider + Agent Worker + post_analysis + 详情完整分析 + 卡片带分析 | 核心差异化到位 |
| **M4 图谱+时效性** | post_tickers 图谱视图 + 立场时间线 + 转向检测 & 推送 | 关系/共识/时效全到位 |
| **M5 账号层** | magic-link 登录 + follows 云同步 + 邮件摘要 | "两者都要"的登录态闭环 |

横切：合规免责声明从 M1 起铺；两个可插拔接口 M1 定好。

---

## 14 · 后续切片（不在本 MVP）

1. **博主战绩排行榜**：跟踪发帖后个股真实表现，算准确率 / 收益打分排行；天然话题度 + 合规护盾；给图谱边加权。
2. **交易跳转 + 入场金额**：券商个股下单页深链 + 用户填风险参数套通用风控模板算示例金额。合规最敏感，放最后。

---

## 15 · 开放问题 / 风险

- **X RSS 桥接脆弱性**：RSSHub/Nitter 实例易被封 → 需多实例 + 健康监测 + 人工提交兜底；必要时引导自托管者用 X-API 自带 key。
- **LLM 成本**：随帖子量线性增长 → 靠缓存 + 幂等 + 预算上限控制；需观测实际单帖成本。
- **近实时 vs 轮询**：MVP 几分钟级轮询；若"够快"成为口碑命门，再评估升级。
- **合规边界**：Agent 措辞需持续把关在"摘要"而非"建议"；分析师目标价 / 评级的呈现避免变成荐股。
- **数据 provider 选型**：免费档配额 / 延迟 / 字段覆盖需实测后定主用 + 降级链。

---

## 16 · 建造方式（DRI 决定，如实记录）

本项目经 DRI 明确决定采用 **纯 vibecoding**：

- 不产出正式 plan 文档、不设第二 session 评审门，照本 spec 直接快速迭代开发。
- 不强制每段 diff commit 前逐段人眼复核。

**这是对团队 CLAUDE.md「SOP 不可妥协 #1（never vibe code）」与「底线规则（每段 AI diff 过人眼）」的有意豁免，仅限本项目。** 设计阶段已向 DRI 明示该冲突与风险（金融/交易相关代码，bug 代价包括误导用户），DRI 知情后选择此模式。本 spec 即本项目唯一的设计锚点。
