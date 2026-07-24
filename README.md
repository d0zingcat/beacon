# beacon

**English** | [简体中文](./README.zh-CN.md)

Beacon — a Cloudflare Workers service for crawling, storing, and notifying on information updates.

Two source modes:

- **append** — blogs, changelogs, new model releases (dedupe by hash)
- **state** — VPS stock, pricing, availability (notify on state diff)

## Try it

A public instance is deployed at **https://beacon.d0zingcat.workers.dev/** — you can use it directly without deploying your own.

```bash
# Health check
curl https://beacon.d0zingcat.workers.dev/health

# List supported sources
curl https://beacon.d0zingcat.workers.dev/sources

# Query recent items
curl "https://beacon.d0zingcat.workers.dev/items?limit=10"

# Browse in a browser:
# https://beacon.d0zingcat.workers.dev/
# https://beacon.d0zingcat.workers.dev/browse/sources

# Aggregated RSS feed (filter by source, default: all append sources)
curl "https://beacon.d0zingcat.workers.dev/feed"
curl "https://beacon.d0zingcat.workers.dev/feed?source=openai-blog&source=anthropic-blog&limit=20"

# Trigger a crawl for a specific source
curl -X POST "https://beacon.d0zingcat.workers.dev/sources/cursor-changelog/run"
```

> Note: the public instance is pre-configured with all supported sources. Crawl schedules run automatically. Custom notification channels (Telegram / Feishu) are not available on the shared instance.

## Supported sources

Beacon ships with **24 built-in sources**. Apply D1 migrations after deploy so RSS feed sources are registered.

| ID | Mode | Extractor | Tracks |
|----|------|-----------|--------|
| `cursor-changelog` | append | webpage | [Cursor Changelog](https://cursor.com/changelog) |
| `cursor-blog` | append | webpage | [Cursor Blog](https://cursor.com/blog) |
| `kiro-changelog` | append | feed | [Kiro Changelog](https://kiro.dev/changelog) RSS |
| `openrouter-blog` | append | feed | [OpenRouter Blog](https://openrouter.ai/blog) RSS |
| `openai-blog` | append | feed | [OpenAI News](https://openai.com/news) RSS |
| `lilianweng-blog` | append | feed | [Lil'Log](https://lilianweng.github.io/) RSS |
| `anthropic-blog` | append | webpage | [Anthropic News](https://www.anthropic.com/news) |
| `meta-ai-blog` | append | webpage | [Meta AI Blog](https://ai.meta.com/blog/) (server-rendered cards) |
| `bedrock-models` | append | webpage | [AWS Bedrock model list](https://docs.aws.amazon.com/bedrock/latest/userguide/model-cards.md) |
| `bedrock-docs` | append | feed | [AWS Bedrock User Guide updates](https://docs.aws.amazon.com/bedrock/latest/userguide/) RSS |
| `hy-news` | append | webpage | [Tencent Hy News](https://hy.tencent.com/) (JSON API) |
| `mimo-news` | append | webpage | [Xiaomi MiMo News](https://mimo.xiaomi.com/) (Rspress bundles) |
| `bigmodel-news` | append | webpage | [BigModel Docs Updates](https://docs.bigmodel.cn/cn/update/new-releases) (Mintlify markdown) |
| `minimax-news` | append | webpage | [MiniMax News](https://www.minimaxi.com/news) (JSON API + docs release notes) |
| `kimi-blog` | append | webpage | [Kimi Research Blog](https://www.kimi.com/blog/) (Moonshot AI) |
| `longcat-research` | append | webpage | [LongCat Research](https://longcat.ai/) (Meituan, SPA bundle) |
| `qwen-blog` | append | webpage | [Qwen Blog](https://qwen.ai/research) (Alibaba, page-config JSON API) |
| `gemini-blog` | append | webpage | [Gemini Blog](https://deepmind.google/blog/) (Google DeepMind, server-rendered cards) |
| `xai-news` | append | webpage | [xAI News](https://x.ai/blog) (server-rendered Next.js cards) |
| `deepseek-news` | append | webpage | [DeepSeek News](https://api-docs.deepseek.com/zh-cn/news) |
| `deepseek-updates` | append | webpage | [DeepSeek Updates](https://api-docs.deepseek.com/zh-cn/updates) |
| `seed-news` | append | webpage | [ByteDance Seed](https://seed.bytedance.com/) |
| `artificial-analysis-changelog` | append | webpage | [Artificial Analysis Changelog](https://artificialanalysis.ai/changelog) (server-rendered timeline) |
| `dmit-stock` | state | webpage | [DMIT VPS stock](https://stock.qixi.me/) aggregator (notify on availability change) |

| Category | Sources |
|----------|---------|
| Changelogs & blogs | `cursor-changelog`, `cursor-blog`, `kiro-changelog`, `openrouter-blog`, `openai-blog`, `lilianweng-blog`, `anthropic-blog`, `meta-ai-blog`, `bedrock-docs`, `hy-news`, `mimo-news`, `bigmodel-news`, `minimax-news`, `kimi-blog`, `longcat-research`, `qwen-blog`, `gemini-blog`, `xai-news`, `deepseek-news`, `deepseek-updates`, `seed-news`, `artificial-analysis-changelog` |
| Model catalogs | `bedrock-models` |
| Infrastructure | `dmit-stock` |

Cron schedules (see `wrangler.jsonc`): blogs and RSS feeds run **hourly**; `bedrock-models` every **6 hours**; `dmit-stock` every **15 minutes**.

Feed sources are seeded in D1 (`migrations/0003_feed_source_config.sql`) and loaded at startup. Webpage sources are defined in `src/sources/examples/`.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button?paid=true)](https://deploy.workers.cloudflare.com/?url=https://github.com/d0zingcat/beacon&paid=true)

> Requires **D1**, **Queues**, and **Browser Rendering** on a [paid Workers plan](https://developers.cloudflare.com/workers/platform/pricing/). The deploy button forks the repo and provisions D1 / Queue / Browser bindings via Workers Builds.

## Stack

- Cloudflare Workers + TypeScript
- D1 (SQLite)
- Queues (decoupled crawl jobs)
- Browser Rendering (`@cloudflare/puppeteer`)
- Cron Triggers
- Hono (HTTP API)
- Server-rendered public web UI
- Telegram / Feishu (notifications)

## One-click deploy

1. Click **Deploy to Cloudflare** above
2. Connect GitHub and Cloudflare, confirm resource names
3. After deploy, set optional secrets in Dashboard → Worker → **Settings → Variables and Secrets**:
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_CHAT_ID`
   - `FEISHU_WEBHOOK_URL`
   - `WEBHOOK_ENCRYPTION_KEY` (32-byte secret for user Feishu webhooks)
4. If tables are missing, apply migrations locally or in CI:

```bash
pnpm exec wrangler d1 migrations apply beacon-db --remote
```

5. Verify: `https://<your-worker>.<account>.workers.dev/health`

See [Deploy to Cloudflare](https://developers.cloudflare.com/workers/platform/deploy-buttons/).

## Local development

```bash
pnpm install
pnpm run cf-typegen
pnpm run typecheck
pnpm exec wrangler d1 migrations apply beacon-db --local
pnpm run dev
```

`pnpm run dev` uses `wrangler.local.jsonc` (no Browser binding). For Browser Rendering: `pnpm run dev:remote` (requires `wrangler login`).

### Quick check

```bash
curl http://localhost:8787/health    # {"ok":true,"service":"beacon"}
curl http://localhost:8787/sources
```

## GitHub Actions deploy (recommended)

Push to `main` or run the **Deploy** workflow manually. CI runs tests, reads `D1_DATABASE_ID` from Secrets, generates a deploy config, applies migrations, and deploys.

> Wrangler cannot reference env vars inside `wrangler.jsonc` ([workers-sdk#12769](https://github.com/cloudflare/workers-sdk/issues/12769)). The tracked config keeps placeholder `local-beacon-db`. Production deploy uses `scripts/generate-deploy-config.mjs` to write gitignored `.wrangler/deploy/wrangler.jsonc` without modifying tracked files.

Configure in **Settings → Secrets and variables → Actions**:

| Secret | Description |
|--------|-------------|
| `CLOUDFLARE_API_TOKEN` | [API token](https://dash.cloudflare.com/profile/api-tokens) with Workers Scripts, D1, Queues edit |
| `CLOUDFLARE_ACCOUNT_ID` | Account ID (Dashboard sidebar) |
| `D1_DATABASE_ID` | Remote D1 UUID (`wrangler d1 list` or `d1 create` output) |
| `FEISHU_WEBHOOK_URL` | Feishu bot webhook URL (optional; synced to Worker on deploy) |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token (optional) |
| `TELEGRAM_CHAT_ID` | Telegram chat ID (optional) |

GitHub Secrets are **not** available to the Worker at runtime by themselves. The Deploy workflow runs `wrangler secret put` after each deploy so notification channels reach `env.FEISHU_WEBHOOK_URL` etc. Do **not** put notification keys in `wrangler.jsonc` `vars` — empty values would override Worker secrets on every deploy.

### API token permissions

Start from the **Edit Cloudflare Workers** template, then add:

- **D1** — Edit
- **Queues** — Edit
- **Workers Observability** — Edit (recommended)

Scope the token to your account only.

## Manual deploy

```bash
pnpm install
pnpm exec wrangler login

pnpm exec wrangler d1 create beacon-db
pnpm exec wrangler d1 migrations apply beacon-db --remote

pnpm exec wrangler secret put TELEGRAM_BOT_TOKEN
pnpm exec wrangler secret put TELEGRAM_CHAT_ID
pnpm exec wrangler secret put FEISHU_WEBHOOK_URL   # optional
pnpm exec wrangler secret put WEBHOOK_ENCRYPTION_KEY # required for user Feishu subscriptions

D1_DATABASE_ID=<your-d1-uuid> pnpm run deploy:prod
```

First deploy auto-creates `beacon-crawl` and `beacon-crawl-dlq` queues.

### Email sending

Production magic-link login uses the `EMAIL` binding via Cloudflare Email Sending. Enable a verified sender domain before deploying:

```bash
pnpm exec wrangler email sending enable <your-domain>
```

Production login requires the `EMAIL` binding and a verified sender domain; local development can set `APP_ENV=local` to print links to logs.

## Environment variables

Set plain vars in `wrangler.jsonc` or secrets via `wrangler secret put`:

| Variable | Description | Required |
|----------|-------------|----------|
| `TELEGRAM_BOT_TOKEN` | Telegram bot token | No |
| `TELEGRAM_CHAT_ID` | Chat ID for alerts | No |
| `FEISHU_WEBHOOK_URL` | Feishu bot webhook URL | No |
| `RUN_TOKEN` | Bearer token to protect `POST /sources/:id/run` | No |
| `WEBHOOK_ENCRYPTION_KEY` | 32-byte key used to encrypt user Feishu webhook URLs | For user subscriptions |
| `APP_ENV` | Set to `local` to log magic-link emails instead of requiring the Email binding | No |

Configure at least one global channel for deployment-level notifications. User-managed Feishu subscriptions are separate and require `WEBHOOK_ENCRYPTION_KEY`. Magic-link login uses the Cloudflare Email Sending `EMAIL` binding in production; local development can set `APP_ENV=local` to print links to logs. D1 / Queue / Browser use wrangler bindings.

### Web UI and subscriptions

Beacon serves a small first-party web UI from the Worker:

| Path | Description |
|------|-------------|
| `/` | Public recent item stream |
| `/browse/sources` | Public source directory |
| `/browse/sources/:id` | Public source detail and recent items |
| `/login` | Email magic-link login |
| `/app/subscriptions` | Logged-in Feishu subscription center |

Browsing is public. Subscription management requires email login. Users can add their own Feishu custom bot webhook, receive a test message, and choose which sources should notify that webhook. Stored user webhooks are encrypted in D1 and are not returned to the browser after saving.

`FEISHU_WEBHOOK_URL` remains the optional global deployment webhook. It is independent from user-managed Feishu webhooks.

Users can pause and resume individual source subscriptions from `/app/subscriptions`.

Per-user Feishu delivery is synchronous in the MVP. If subscription volume grows, move delivery to a dedicated notify queue before treating it as high-throughput infrastructure.

### RUN_TOKEN

When `RUN_TOKEN` is set, `POST /sources/:id/run` requires the token via `Authorization: Bearer <token>` header or `?token=<token>` query parameter. Requests without a valid token receive `401 Unauthorized`. If unset, the endpoint remains open (default).

```bash
curl -X POST "https://<your-worker>.<account>.workers.dev/sources/cursor-changelog/run?token=your-secret-token"
# or
curl -X POST "https://<your-worker>.<account>.workers.dev/sources/cursor-changelog/run" \
  -H "Authorization: Bearer your-secret-token"
```

Set it via `wrangler secret put RUN_TOKEN`.

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/sources` | List registered sources |
| GET | `/items` | Query items (`?source=&mode=&limit=&cursor=`) |
| GET | `/items/:id` | Item detail |
| GET | `/items/:id/states` | State history (state mode) |
| GET | `/items/:id/states/latest` | Latest state |
| GET | `/feed` | Aggregated RSS feed of `append` sources (`?source=` filter, repeatable; `?limit=`, `?sort=published_at|created_at|id|updated_at`, `?order=asc|desc`) |
| POST | `/sources/:id/run` | Trigger crawl (enqueue; `?sync=1` inline; `?forceNotify=1` notify all fetched items; requires `RUN_TOKEN` if set) |
| GET | `/runs` | Run logs |

To verify notifications when there are no new items, run with `forceNotify=1` (sends one message per fetched item):

```bash
curl -X POST "https://beacon.example.workers.dev/sources/bedrock-models/run?sync=1&forceNotify=1"
```

Response includes `itemsNotified` (count of messages sent this run).

## Adding a source

### append (RSS)

```ts
import { createFeedExtractor } from '../../extract/feed';
import { createSource } from '../factory';

createSource(
  { id: 'my-feed', name: 'My Feed', mode: 'append', schedule: '0 * * * *' },
  createFeedExtractor({ feedUrl: 'https://example.com/rss.xml' }),
);
```

Add `import './my-feed'` in `src/sources/examples/index.ts`.

### append (webpage / Markdown)

```ts
import { createWebpageExtractor } from '../../extract/webpage';
import { createSource } from '../factory';

createSource(
  { id: 'my-page', name: 'My Page', mode: 'append', schedule: '0 * * * *' },
  createWebpageExtractor({
    url: 'https://example.com/changelog',
    parse: (html) => [/* RawItem[] */],
  }),
);
```

### state (Browser)

```ts
import { createSource } from '../factory';

createSource(
  {
    id: 'my-stock',
    name: 'My VPS Stock',
    mode: 'state',
    schedule: '*/15 * * * *',
    diff(prev, next) {
      return prev.available !== next.available;
    },
  },
  {
    kind: 'browser',
    async extract(ctx) {
      if (!ctx.browser) throw new Error('Browser binding is not available');
      return [];
    },
  },
);
```

## Architecture

```
Cron (scheduled) → enqueue CRAWL_QUEUE
                      ↓
Queue consumer → runSource(sourceId)
                      ↓
              Source registry + extractor
                      ↓
         ┌────────────┴────────────┐
    append mode                 state mode
    hash dedupe → items        diff state → snapshots
         └────────────┬────────────┘
                      ↓
         Telegram / Feishu (optional)
                      ↓
              Hono query API
```

## Layout

```
src/
├── index.ts          # Worker entry (fetch / scheduled / queue)
├── router.ts         # Hono API
├── scheduler.ts      # Cron scheduling
├── sources/          # Registry + factory
│   └── examples/
├── crawler/          # Runner, dedupe, state
├── db/               # D1 repositories
├── notify/           # Format, transport, dispatch
├── extract/          # feed / webpage / browser extractors
└── queue/            # Queue consumer
migrations/           # D1 SQL migrations
.github/workflows/    # CI + Deploy (Node 24)
scripts/              # generate-deploy-config.mjs
```

## Related docs

- [README.zh-CN.md](./README.zh-CN.md) — Chinese readme
- [HANDOFF.md](./HANDOFF.md) — Handoff notes (Chinese)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
