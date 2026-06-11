<div align="center">

<img src="docs/promo/hero.png" alt="X2T — 把 X 上的噪音拧成可追踪的交易信号" width="720" />

<h1>X2T · X to Trade</h1>

**追踪你关注的金融博主到底在说什么 —— 每条帖子由 AI 读成对个股的看多/看空判断,并用他们真实的历史战绩打分,中英双语呈现。**

[![License: MIT](https://img.shields.io/badge/License-MIT-0c0c0c.svg)](LICENSE)
[![LLM: multi-provider fallback](https://img.shields.io/badge/LLM-multi--provider%20fallback-4d6bfe)](#一键部署)
[![Live demo](https://img.shields.io/badge/demo-x2t.actionow.ai-c9f24a?labelColor=0c0c0c)](https://x2t.actionow.ai)

[**在线试用**](https://x2t.actionow.ai) · [English](README.md) · [简体中文](README.zh-CN.md) · [部署](DEPLOY.md)

</div>

---

## 概览

X2T 盯着你在 X(Twitter)、Reddit、新闻源上关注的金融博主,用 AI 结合实时行情,把每条帖子读成对个股的看多/看空/中性判断。判断聚合成个股共识、多空辩论与立场图谱;有人改口立刻推送;每条判断都拿市场结算,给每位博主一份诚实的、统计上站得住的历史战绩。开源,可自托管。

> [!IMPORTANT]
> **非投资建议。** X2T 聚合的是公开帖子与公开市场数据,仅供参考,不构成任何买卖建议。

**在线试用:** [x2t.actionow.ai](https://x2t.actionow.ai) —— 内置约 24 个精选美股源,中英双语,什么都不用装。

## 功能

<div align="center">
<img src="docs/promo/features.png" alt="X2T 功能全景:AI 标立场、诚实战绩、转向雷达、立场图谱、共识与辩论、自带 LLM、全站搜索、推送与 RSS" width="830" />
</div>

<details>
<summary><b>完整功能清单</b></summary>

| | |
| --- | --- |
| **多源抓取** | 自建 RSSHub 网关(X / Reddit)、可直连 RSS(新闻 / Substack)、或手动提交。开箱内置约 24 个精选美股源。按 `(博主, platformPostId)` 幂等去重。 |
| **结合行情的 AI 分析** | LLM agent 用帖子原始语种分析,抽取标的(cashtag + 公司/产品/A股名),按标的拉实时数据,判断博主观点与价格/消息/情绪是一致还是背离 —— 并**校准置信度**:喊单、反讽、细价股炒作、转发新闻一律**不当**高置信判断。已结算的战绩会**回灌进 prompt(信念回路)**,agent 读每条新帖时都带着该博主的真实历史。 |
| **自带 LLM** | 任意 OpenAI 或 Anthropic 兼容端点(DeepSeek、GPT、Claude、Gemini、聚合中转)。可配**多 provider 顺序兜底链** —— 按编号配多个端点,各自独立的 base URL / key / 模型 / 协议格式,报错/超时/429/5xx/空响应时按序自动降级。翻译用更便宜的模型,且按端点解耦。 |
| **历史战绩 —— 护城河** | 每条多空判断按**同期 SPY** 在 5 个交易日后回测。每位博主给出**「跑赢大盘」率** + **Wilson 95% 置信区间** + 样本门槛(杜绝「20 条样本 50%」式的误导)。**战绩榜**用 **Benjamini–Hochberg FDR** 多重比较校正排名(榜首不是运气),外加**「如果跟单」权益曲线**与**校准面板** —— 近期加权跑赢率、Brier 分、5 日 / 20 日双结算窗口。 |
| **立场轨迹** | 每位博主的立场账本(对各标的的最新立场 + 转向标记)、立场翻转检测,以及首页仪表盘上的「近期转向」看板。每个标的页还有**净立场 vs 价格**叠加图,喊单对没对上走势一眼可见。 |
| **共识与辩论** | 个股跨博主共识(每人一票、取最新立场、小样本会标注)、从真实 rationale 派生的 **Bull vs Bear 多空辩论视图**(多头论据 / 空头论据 / 分歧点),以及 d3-force「博主 ↔ 标的」**立场图谱**(边按新近度加权、转向标记、缩放、全屏、读屏文本)。新闻搬运号会被标注,避免「共识」被头条稀释。 |
| **搜索与分页** | 全站搜索:标的/博主直达、跨原文与中英译文的全文检索、立场过滤。信号流/博主页/搜索结果都支持游标式「加载更多」。 |
| **告警与摘要** | 可组合**告警规则**(如:*某股 看多博主 ≥N 且 出现翻转 → 推送*)、按博主的翻转推送、以及 opt-in 的**每日邮件摘要**(头部突出立场转向)。通知治理:按 (帖×订阅) 去重、冷却、日上限、静音时段。 |
| **结构化 RSS** | 每条 feed 带机读字段 `x2t:stance / confidence / divergence / ticker`;独立的 **`/rss/flips`** 立场转向事件流(带 `x2t:flip`);可组合 `?sig=1` / `?conf=0.7` 过滤,供量化/看板消费。 |
| **社交** | 赞 / 踩 带计数(匿名也可),一键**分享图卡**(客户端 `<canvas>`)、一键发 X,以及服务端渲染的**动态 OG 分享图**(纸感品牌风,覆盖每个帖子/博主/标的页;标的卡内嵌「净立场 vs 价格」迷你走势图)。 |
| **账号** | 免密**邮箱验证码**登录(6 位 OTP,不发链接)。登录后关注列表云同步,未登录则浏览器本地存;信号流默认「信号优先」压住中性新闻噪音。 |
| **双语 · 响应式 UI** | Cookie 中英切换、帖子三版本(原文 / 中文 / English)、刻意的 neo-brutalist *Tape* 设计语言、PC 多栏 / 移动单栏 + 抽屉导航。 |
| **生产级加固** | Redis 可选限流、admin 与密钥 fail-closed、HMAC 会话带撤销、SSRF 防护的图片代理与价格抓取、CSP、复合索引 + 有界缓存查询、自愈 worker、完整 SEO(metadata / sitemap / robots / JSON-LD / OpenGraph)与分析。 |

</details>

## 工作原理

<div align="center">
<img src="docs/promo/how-it-works.png" alt="X2T 流水线:抓取公开帖子 → AI 标立场 → 聚合视图 → 价格结算 → 诚实战绩,立场转向即时推送" width="830" />
</div>

一个容器同时跑 Web 与后台 worker:每几分钟拉新帖、AI 逐条标立场、转向即时推送、判断按同期 SPY 结算 —— 用正经统计打分(Wilson 区间、FDR 校正),不是裸胜率。

## 一键部署

```bash
# clone 本仓库后执行,唯一前置是 Docker
./deploy.sh
```

<div align="center">
<img src="docs/promo/deploy.png" alt="deploy.sh:生成 .env 与随机密钥 → 起 Postgres、RSSHub、应用 → 建表灌种子 → localhost:53000。零 key 全 mock 可跑,填 key 即变真" width="830" />
</div>

全部开关见 [`.env.example`](.env.example);云上部署([Zeabur](https://zeabur.com))分步指南见 **[DEPLOY.md](DEPLOY.md)**。

> **需要服务器?** 在 [**Zeabur**](https://zeabur.com) 下单,结账时填邀请码 **`actionow.ai`** 享 9 折。

## 贡献

欢迎 Issue 与 PR,较大改动请先开 Issue 讨论。本机开发:`docker compose up -d db rsshub && pnpm install && pnpm db:push && pnpm db:seed && pnpm dev`,提交前跑 `npx tsc --noEmit` 与 `pnpm test`。

## 友情链接

[LINUX DO](https://linux.do/) — 新的理想型社区

## 许可证

[MIT](LICENSE) © actionow.ai

<div align="center">
<sub>开源 · 可自部署 · 非投资建议</sub>
</div>
