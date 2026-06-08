# X2T — X to Trade

**English** | [简体中文](README.zh-CN.md)

Aggregate trading signals from the financial influencers you follow on X (Twitter), Reddit and beyond. The moment they post, X2T fetches it, runs AI analysis grounded in live market data, produces bilingual summaries, maps an influencer-by-ticker stance graph, and pushes alerts when someone flips.

> **Not financial advice.** X2T aggregates public posts and public market data for reference only. Nothing here is a recommendation to buy or sell anything.

> **Live demo:** https://x2t-actionow.zeabur.app — self-hosted on Zeabur (see [DEPLOY.md](DEPLOY.md)).

---

## What it does

- **Multi-source ingestion.** Pulls posts through a self-hosted RSSHub gateway (X / Reddit / StockTwits), plain RSS, or manual submission. Idempotent dedup on `(influencer, platformPostId)`.
- **AI analysis grounded in market data.** Each post is analyzed by a DeepSeek V4 agent in the post's original language: it extracts tickers (cashtags plus company/product names), pulls live external data per ticker, and judges whether the influencer's stance agrees with or diverges from the current price, news and sentiment — with calibrated confidence (abstains to neutral when evidence is thin).
- **Original / Chinese / English everywhere.** A cheaper flash model translates every post and analysis; the original-language slot keeps the agent's own text, so each item reads in its source language plus zh and en.
- **Pluggable external data, with graceful degradation.** Finnhub (quote / profile / company news), Exa (semantic news), Alpha Vantage (news sentiment). Any provider whose API key is unset is skipped silently; with no keys at all it falls back to deterministic mock data.
- **Force-directed stance graph.** An influencer-to-ticker knowledge graph (d3-force): recency-weighted edges, flip markers, drag to rearrange, fullscreen, and click a node to see the related posts.
- **Consensus and flip alerts.** Per-ticker consensus across influencers, plus stance-flip detection that triggers web-push notifications.
- **Accounts and following.** Passwordless magic-link email login. Follows sync to the cloud when logged in, or live in the browser when anonymous; the home feed filters to who you follow.
- **Web push.** VAPID web-push for new posts and stance flips.
- **Bilingual UI (zh / en)** with a cookie-based locale switch, in a neo-brutalist ("Tape") design.
- **Admin console** for managing influencer sources, posts (delete / re-analyze) and users.
- **Production hardening.** In-memory rate limiting, fail-closed admin and session secrets, composite indexes, bounded graph/consensus queries with an in-process cache, and a self-healing worker with expired-cache GC.
- **SEO and analytics.** Locale-aware metadata, OpenGraph image, `sitemap.xml`, `robots.txt`, JSON-LD, and Google Analytics.

## How it works

```
sources ──ingest──> Post (deduped) ──analyze──> AI agent ─┐
(RSSHub/RSS/manual)                  (DeepSeek V4-pro)     │
                                                          ├─> translate (V4-flash) ─> zh / en
   external data per ticker ────────────────────────────>┤
   (Finnhub / Exa / Alpha Vantage)                        │
                                                          └─> stance graph · consensus · flip → web-push
```

A single combined container runs both the Next.js web app and a background worker. The worker loops: fetch all active sources, drain the analysis queue (small concurrency pool with per-call timeout), detect flips and push, then GC expired cache.

## Tech stack

Next.js 15 (App Router) + React 19 + TypeScript · Prisma 6 + PostgreSQL · DeepSeek V4 via the OpenAI-compatible SDK · d3-force · GSAP · web-push (VAPID) · rss-parser · zod · self-hosted RSSHub · Cloudflare Email Service or SMTP. Deployed on Zeabur.

## Quick start

Prerequisites: Node 20+, pnpm, and Docker (for local Postgres + RSSHub).

```bash
# 1. Start dependencies: Postgres (55432) + RSSHub (51200) — non-standard ports to avoid clashes
docker compose up -d db rsshub

# 2. Configure environment (first run)
cp .env.example .env
# generate a session secret and put it in AUTH_SECRET:
openssl rand -hex 32

# 3. Install + create the schema
pnpm install
pnpm db:push

# 4. Seed example influencer sources
pnpm db:seed

# 5. Run the web app
pnpm dev            # http://localhost:53000

# 6. (optional) Run the background worker in another terminal
pnpm worker         # ingest -> analyze -> push, on a loop
```

## Configuration

All integrations follow one rule: **leave the env var blank and it degrades to mock; fill it in and it goes live.** See [`.env.example`](.env.example) for the full list, grouped by area: Postgres, app URL, Google Analytics, ingestion/polling, RSSHub, web-push (VAPID), LLM (OpenAI-compatible / DeepSeek), market data (Finnhub / Exa / Alpha Vantage), accounts + email, and the admin allowlist.

## Project structure

```
src/
  app/            # routes: feed /, /graph, /following, /submit, /login,
                  #         /p/[id], /i/[handle], /t/[symbol], /admin/*, /api/*
                  # plus icon.svg, favicon.ico, sitemap.ts, robots.ts
  components/      # PostCard, PostDetail, GraphCanvas, FollowButton, ...
  lib/
    connectors/   # ingestion sources (rss, manual)
    llm/          # LLM providers (openai-compatible, mock)
    marketdata/   # finnhub, exa, alphavantage, fmp, mock + caching aggregator
    agent.ts      # post analysis pipeline
    translate.ts  # flash translation layer
    stance.ts     # consensus, graph data, flip detection
    seo.ts, auth.ts, push.ts, ingest.ts, ...
scripts/          # worker.ts, poll.ts, analyze.ts, digest.ts, seed.ts, gen-logo.mjs
prisma/           # schema.prisma
```

## Scripts

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Web app (port 53000) |
| `pnpm worker` | Background loop: ingest + analyze + push |
| `pnpm worker:once` | One worker pass (for external cron) |
| `pnpm poll` / `pnpm analyze` | Ingestion-only / analysis-only loops |
| `pnpm digest` | Send the daily email digest |
| `pnpm db:push` / `pnpm db:seed` / `pnpm db:studio` | Prisma schema / seed / studio |
| `node scripts/gen-logo.mjs` | Regenerate the logo, favicon and OG image |

## Deployment

X2T is built for [Zeabur](https://zeabur.com): a combined web + worker image, with Postgres and RSSHub as sibling services. Step-by-step instructions are in [DEPLOY.md](DEPLOY.md).

> **Need a server?** Buy one at **https://zeabur.com** and enter referral code **`actionow.ai`** at checkout for 10% off.

## License

No license file yet — add a `LICENSE` (MIT recommended) before distributing.
