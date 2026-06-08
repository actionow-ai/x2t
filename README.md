<div align="center">

<img src="public/og.png" alt="X2T — X to Trade" width="720" />

<h1>X2T · X to Trade</h1>

**Aggregate trading signals from the financial influencers you follow — analyzed by AI, grounded in live market data, in Chinese and English.**

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

X2T watches the financial influencers you follow on X (Twitter), Reddit and beyond. The moment one of them posts, X2T fetches it, runs an AI agent that grounds the post against live market data, writes a bilingual summary, plots an influencer-by-ticker stance graph, and pushes an alert when someone flips their stance. It is open source and built to self-host.

> [!IMPORTANT]
> **Not financial advice.** X2T aggregates public posts and public market data for reference only. Nothing here is a recommendation to buy or sell anything.

### Try it live — no setup

A public trial instance runs at **[x2t.actionow.ai](https://x2t.actionow.ai)**. Browse the signal feed and AI analysis, explore the stance graph and per-stock consensus, switch between Chinese and English, follow influencers and enable push — all in the browser, nothing to install.

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
| **Multi-source ingestion** | Self-hosted RSSHub gateway (X / Reddit / StockTwits), plain RSS, or manual submission. Idempotent dedup on `(influencer, platformPostId)`. |
| **AI analysis, grounded** | A DeepSeek V4 agent analyzes each post in its original language, extracts tickers (cashtags plus company / product names), pulls live data per ticker, and judges whether the influencer agrees with or diverges from price, news and sentiment — with calibrated confidence. |
| **Original / 中文 / English** | A cheaper flash model translates every post and analysis; the source-language slot keeps the agent's own words, so each item reads in three versions. |
| **Pluggable market data** | Finnhub (quote / profile / news), Exa (semantic news), Alpha Vantage (news sentiment). Every provider is key-gated and degrades gracefully — no keys at all falls back to deterministic mock data. |
| **Stance graph** | A force-directed influencer-to-ticker graph (d3-force): recency-weighted edges, flip markers, drag, fullscreen, click a node for related posts. |
| **Consensus & flip alerts** | Per-ticker consensus across influencers, plus stance-flip detection that fires web-push notifications. |
| **Accounts & following** | Passwordless magic-link email login. Follows sync to the cloud when logged in, live in the browser when anonymous; the home feed filters to who you follow. |
| **Bilingual, neo-brutalist UI** | Cookie-based zh / en switch, a deliberate "Tape" design system. |
| **Production-ready** | Rate limiting, fail-closed admin and secrets, composite indexes, bounded queries with an in-process cache, a self-healing worker, image proxy for blocked avatar CDNs, plus full SEO (metadata, sitemap, robots, JSON-LD, OpenGraph) and analytics. |

## How it works

```
 sources ──ingest──▶ Post (deduped) ──analyze──▶ AI agent ─┐
 RSSHub / RSS / manual              DeepSeek V4-pro         │
                                                           ├─▶ translate (V4-flash) ─▶ zh / en
   live market data per ticker ────────────────────────────┤
   Finnhub · Exa · Alpha Vantage                            │
                                                           └─▶ stance graph · consensus · flip ─▶ web-push
```

A single combined container runs both the Next.js web app and a background worker. The worker loops: fetch all active sources → drain the analysis queue (small concurrency pool with per-call timeout) → detect flips and push → GC expired cache.

## Tech stack

![Next.js](https://img.shields.io/badge/Next.js%2015-0c0c0c?logo=next.js)
![React](https://img.shields.io/badge/React%2019-20232A?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?logo=prisma)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![d3](https://img.shields.io/badge/d3--force-F9A03C?logo=d3.js&logoColor=white)
![GSAP](https://img.shields.io/badge/GSAP-88CE02?logo=greensock&logoColor=black)

Next.js 15 App Router + React 19 + TypeScript · Prisma 6 + PostgreSQL · DeepSeek V4 via the OpenAI-compatible SDK · d3-force · GSAP · web-push (VAPID) · rss-parser · zod · self-hosted RSSHub · Cloudflare Email Service or SMTP. Runs as a combined web + worker image on Zeabur.

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

# 4. Seed example influencer sources
pnpm db:seed

# 5. Run the web app
pnpm dev                       # http://localhost:53000

# 6. (optional) Run the background worker in another terminal
pnpm worker                    # ingest -> analyze -> push, on a loop
```

## Configuration

Every integration follows one rule: **leave the env var blank and it degrades to mock; fill it in and it goes live.** See [`.env.example`](.env.example) for the full, commented list — grouped into Postgres, app URL, Google Analytics, ingestion / polling, RSSHub, web-push (VAPID), LLM (OpenAI-compatible / DeepSeek), market data (Finnhub / Exa / Alpha Vantage), accounts + email, and the admin allowlist.

## Deployment

X2T ships as a combined web + worker image, with Postgres and RSSHub as sibling services. Step-by-step instructions for [Zeabur](https://zeabur.com) are in **[DEPLOY.md](DEPLOY.md)**.

> **Need a server?** Buy one on [**Zeabur**](https://zeabur.com) and enter referral code **`actionow.ai`** at checkout for 10% off.

## Project structure

```
src/
  app/            # routes: feed /, /graph, /following, /submit, /login,
                  #         /p/[id], /i/[handle], /t/[symbol], /admin/*, /api/*
                  # plus icon.svg, favicon.ico, sitemap.ts, robots.ts
  components/      # PostCard, PostDetail, GraphCanvas, Avatar, FollowButton, ...
  lib/
    connectors/   # ingestion sources (rss, manual)
    llm/          # LLM providers (openai-compatible, mock)
    marketdata/   # finnhub, exa, alphavantage, fmp, mock + caching aggregator
    agent.ts      # post analysis pipeline
    translate.ts  # flash translation layer
    stance.ts     # consensus, graph data, flip detection
    seo.ts, auth.ts, push.ts, ingest.ts, img.ts, ...
scripts/          # worker.ts, poll.ts, analyze.ts, digest.ts, seed.ts, gen-logo.mjs
prisma/           # schema.prisma
```

## Scripts

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Web app (port 53000) |
| `pnpm worker` / `pnpm worker:once` | Background loop / single pass (ingest + analyze + push) |
| `pnpm poll` · `pnpm analyze` | Ingestion-only / analysis-only loops |
| `pnpm digest` | Send the daily email digest |
| `pnpm db:push` · `pnpm db:seed` · `pnpm db:studio` | Prisma schema / seed / studio |
| `node scripts/gen-logo.mjs` | Regenerate the logo, favicon and OpenGraph image |

## Contributing

Issues and pull requests are welcome. For larger changes, open an issue first to discuss the direction. Run `pnpm lint` and `npx tsc --noEmit` before submitting.

## License

[MIT](LICENSE) © actionow.ai

<div align="center">
<sub>Built with Next.js · Self-hosted on Zeabur · Not financial advice</sub>
</div>
