<div align="center">

<img src="public/og.png" alt="X2T — X to Trade" width="720" />

<h1>X2T · X to Trade</h1>

**Track what the financial influencers you follow are actually saying — every post read into a bullish / bearish call on specific tickers by AI, scored against their real track record, in Chinese and English.**

[![License: MIT](https://img.shields.io/badge/License-MIT-0c0c0c.svg)](LICENSE)
[![Next.js 15](https://img.shields.io/badge/Next.js-15-0c0c0c?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![PostgreSQL + Prisma](https://img.shields.io/badge/PostgreSQL-Prisma-4169E1?logo=postgresql&logoColor=white)](https://www.prisma.io)
[![DeepSeek V4](https://img.shields.io/badge/AI-DeepSeek%20V4-4d6bfe)](https://deepseek.com)
[![Live demo](https://img.shields.io/badge/demo-x2t.actionow.ai-c9f24a?labelColor=0c0c0c)](https://x2t.actionow.ai)

[**Live demo**](https://x2t.actionow.ai) · [English](README.md) · [简体中文](README.zh-CN.md) · [Deploy](DEPLOY.md)

</div>

---

## Overview

X2T watches the financial influencers you follow on X (Twitter), Reddit and news/Substack feeds. The moment one of them posts, X2T fetches it, runs an AI agent that grounds the post against live market data, reads it into a bullish / bearish / neutral call per ticker, and writes a bilingual summary. It then aggregates those calls into per-stock **consensus**, a **bull-vs-bear debate**, an influencer↔ticker **stance graph**, and — the part nobody else does — an honest **track record**: did following each influencer actually beat the market? It pushes you an alert the moment someone flips their stance. Open source, built to self-host.

> [!IMPORTANT]
> **Not financial advice.** X2T aggregates public posts and public market data for reference only. Nothing here is a recommendation to buy or sell anything.

### Try it live — no setup

A public trial instance runs at **[x2t.actionow.ai](https://x2t.actionow.ai)** with ~24 curated US-stock sources. Browse the signal feed and AI analysis, open the leaderboard, explore the stance graph and per-stock consensus + debate, switch between Chinese and English, follow influencers, react and share — all in the browser, nothing to install.

## Table of contents

- [Features](#features)
- [How it works](#how-it-works)
- [Tech stack](#tech-stack)
- [Quick start](#quick-start)
- [Configuration](#configuration)
- [Deployment](#deployment)
- [Project structure](#project-structure)
- [Scripts](#scripts)
- [Contributing](#contributing)
- [License](#license)

## Features

| | |
| --- | --- |
| **Multi-source ingestion** | Self-hosted RSSHub gateway (X / Reddit), direct RSS (news / Substack), or manual submission. ~24 curated US-stock sources out of the box. Idempotent dedup on `(influencer, platformPostId)`. |
| **Grounded AI analysis** | A DeepSeek V4 agent reads each post in its original language, extracts tickers (cashtags + company / product / A-share names), pulls live data per ticker, and judges agree-vs-diverge against price, news and sentiment — with **calibrated confidence**: emotional hype, sarcasm, penny-stock pumping and forwarded news are deliberately *not* read as high-confidence calls. |
| **Track record — the moat** | Each directional call is back-tested against the **same-window SPY** over 5 trading days. Per influencer: a **"beat the market" rate** with a **Wilson 95 % confidence interval** and a minimum-sample gate (no misleading "50 % off 20 calls"). A **leaderboard** ranks everyone with **Benjamini–Hochberg FDR** correction so the top isn't just luck, plus an **"if you followed" equity curve**. |
| **Stance over time** | Per-influencer stance ledger (latest stance per ticker + flip markers), stance-flip detection, and a *recent flips* board on the home dashboard. |
| **Consensus & debate** | Per-ticker consensus across influencers (one vote each, latest stance, small samples flagged), a **Bull vs Bear debate view** (long case / short case / where they split) derived from real rationales, and a force-directed influencer↔ticker **stance graph** (d3-force, recency-weighted edges, flip markers, zoom, fullscreen, screen-reader text). News-relay accounts are labeled so "consensus" isn't diluted by headlines. |
| **Alerts & digests** | Composable **alert rules** (e.g. *≥N bulls AND a flip on $X → notify me*), per-influencer flip push, and an opt-in **daily email digest** led by stance flips. Notification governance: per-(post×sub) dedup, cooldown, daily cap, quiet hours. |
| **Structured RSS** | Every feed carries machine-readable `x2t:stance / confidence / divergence / ticker`; a dedicated **`/rss/flips`** event stream with `x2t:flip`; composable `?sig=1` / `?conf=0.7` filters for quant/dashboard pipelines. |
| **Social** | Like / dislike with counts (anonymous-friendly), and one-click **share cards** — a neo-brutalist image rendered client-side on `<canvas>`, plus post-to-X. |
| **Accounts** | Passwordless **email verification-code** login (6-digit OTP, no link). Follows sync to the cloud when logged in, live in the browser when anonymous; the feed defaults to signal-first to suppress neutral-news noise. |
| **Bilingual, responsive UI** | Cookie-based zh / en, three-version post views (original / 中文 / English), a deliberate neo-brutalist *Tape* design system, PC multi-column / mobile single-column with a drawer nav. |
| **Production-hardened** | Redis-optional rate limiting, fail-closed admin & secrets, HMAC sessions with revocation, SSRF-guarded image proxy & price fetch, CSP, composite indexes + bounded cached queries, a self-healing worker, full SEO (metadata, sitemap, robots, JSON-LD, OpenGraph) and analytics. |

## How it works

```
 sources ──ingest──▶ Post (deduped) ──analyze──▶ AI agent ──┬─▶ translate (V4-flash) ─▶ zh / en
 RSSHub / RSS / manual               DeepSeek V4-pro         │
                                                            ├─▶ stance graph · consensus · debate
   live market data per ticker ─────────────────────────────┤
   Finnhub · Exa · Alpha Vantage                             ├─▶ flip detect ─▶ web-push + alert rules
                                                            │
   daily price backfill (Yahoo / Stooq) ─▶ PriceDaily ──────┴─▶ beat-market rate · leaderboard · equity curve
```

A single combined container runs both the Next.js web app and a background worker. The worker loops every few minutes: **fetch** all active sources → **analyze** the pending queue (small concurrency pool, per-call timeout) → **detect flips** and fire push + evaluate alert rules → **backfill prices** (daily, for the track-record back-test) → **GC** expired cache → **digest** (optional). Statistics (Wilson CI, bootstrap, Benjamini–Hochberg FDR) are computed in a zero-dependency `stats.ts`.

## Tech stack

![Next.js](https://img.shields.io/badge/Next.js%2015-0c0c0c?logo=next.js)
![React](https://img.shields.io/badge/React%2019-20232A?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?logo=prisma)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![d3](https://img.shields.io/badge/d3--force-F9A03C?logo=d3.js&logoColor=white)
![GSAP](https://img.shields.io/badge/GSAP-88CE02?logo=greensock&logoColor=black)

Next.js 15 App Router + React 19 + TypeScript · Prisma 6 + PostgreSQL · DeepSeek V4 via the OpenAI-compatible SDK · d3-force · GSAP · web-push (VAPID) · rss-parser · zod · Vitest · self-hosted RSSHub · Redis (optional, for cross-instance rate limiting) · Cloudflare Email Service or SMTP · free daily prices from Yahoo Finance / Stooq. Runs as a combined web + worker image on Zeabur.

## Quick start

Prerequisites: Node 20+, pnpm, and Docker (for local Postgres + RSSHub).

```bash
# 1. Start dependencies — Postgres (55432) + RSSHub (51200), non-standard ports to avoid clashes
docker compose up -d db rsshub

# 2. Configure environment (first run)
cp .env.example .env
openssl rand -hex 32          # paste the result into AUTH_SECRET

# 3. Install dependencies and create the schema
pnpm install
pnpm db:push

# 4. Seed example influencer sources (~24 curated US-stock accounts)
pnpm db:seed

# 5. Run the web app
pnpm dev                       # http://localhost:53000

# 6. (optional) Run the background worker in another terminal
pnpm worker                    # ingest -> analyze -> flips/alerts -> prices, on a loop
```

With no API keys, the agent uses deterministic mock market data and the app is fully browsable — every integration is opt-in.

## Configuration

Every integration follows one rule: **leave the env var blank and it degrades to mock; fill it in and it goes live.** See [`.env.example`](.env.example) for the full, commented list — grouped into Postgres, app URL, Google Analytics, ingestion / polling, RSSHub, web-push (VAPID), LLM (OpenAI-compatible / DeepSeek), market data (Finnhub / Exa / Alpha Vantage), accounts + email, rate-limit Redis, daily digest / alert gates, and the admin allowlist. Notable optional knobs: `REDIS_URL` (cross-instance rate limiting), `WORKER_RUN_DIGEST` + an email provider (to actually send digests), `PUSH_COOLDOWN_MINUTES` / `QUIET_HOURS_UTC` (notification governance), `WINRATE_SHOW_SAMPLES` (track-record display threshold).

## Deployment

X2T ships as a combined web + worker image, with Postgres and RSSHub as sibling services. Step-by-step instructions for [Zeabur](https://zeabur.com) are in **[DEPLOY.md](DEPLOY.md)**.

> **Need a server?** Buy one on [**Zeabur**](https://zeabur.com) and enter referral code **`actionow.ai`** at checkout for 10% off.

## Project structure

```
src/
  app/             # routes: feed /, /graph, /leaderboard, /alerts, /following,
                   #         /submit, /login, /p/[id], /i/[handle], /t/[symbol],
                   #         /about /terms /privacy, /rss/all, /rss/flips, /admin/*, /api/*
                   # plus icon.svg, favicon.ico, sitemap.ts, robots.ts
  components/       # PostCard, PostDetail, Reactions, ShareButton, GraphCanvas,
                    # EquitySparkline, NavTabs (drawer), Avatar, FollowButton, ...
  lib/
    connectors/    # ingestion sources (rss, manual)
    llm/           # LLM providers (openai-compatible, mock)
    marketdata/    # finnhub, exa, alphavantage, fmp, mock + caching aggregator
    agent.ts       # post analysis pipeline (ticker extraction + grounded stance)
    stance.ts      # consensus, graph, flips, ledger, beat-market rate, leaderboard, debate
    stats.ts       # zero-dep Wilson CI / bootstrap / Benjamini-Hochberg FDR
    prices.ts      # daily price backfill (Yahoo / Stooq) for the back-test
    alerts.ts      # composable AND/OR alert-rule evaluation
    translate.ts · push.ts · ingest.ts · auth.ts · reactions.ts · digest.ts · img.ts · seo.ts ...
scripts/           # worker.ts, poll.ts, analyze.ts, digest.ts, seed.ts, gen-logo.mjs
prisma/            # schema.prisma
```

## Scripts

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Web app (port 53000) |
| `pnpm worker` / `pnpm worker:once` | Background loop / single pass (ingest + analyze + flips/alerts + prices) |
| `pnpm poll` · `pnpm analyze` | Ingestion-only / analysis-only loops |
| `pnpm digest` | Send the daily email digest |
| `pnpm test` | Vitest unit tests |
| `pnpm db:push` · `pnpm db:seed` · `pnpm db:studio` | Prisma schema / seed / studio |
| `node scripts/gen-logo.mjs` | Regenerate the logo, favicon and OpenGraph image |

## Contributing

Issues and pull requests are welcome. For larger changes, open an issue first to discuss the direction. Run `npx tsc --noEmit` and `pnpm test` before submitting; CI runs both on every push.

## License

[MIT](LICENSE) © actionow.ai

<div align="center">
<sub>Built with Next.js · Self-hosted on Zeabur · Not financial advice</sub>
</div>
