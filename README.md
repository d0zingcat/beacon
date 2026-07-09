# beacon

**English** | [简体中文](./README.zh-CN.md)

Beacon — a Cloudflare Workers service for crawling, storing, and notifying on information updates.

Two source modes:

- **append** — blogs, changelogs, new model releases (dedupe by hash)
- **state** — VPS stock, pricing, availability (notify on state diff)

## Supported sources

Beacon ships with **16 built-in sources**. Apply D1 migrations after deploy so RSS feed sources are registered.

| ID | Mode | Extractor | Tracks |
|----|------|-----------|--------|
| `cursor-changelog` | append | webpage | [Cursor Changelog](https://cursor.com/changelog) |
| `cursor-blog` | append | webpage | [Cursor Blog](https://cursor.com/blog) |
| `kiro-changelog` | append | feed | [Kiro Changelog](https://kiro.dev/changelog) RSS |
| `openrouter-blog` | append | feed | [OpenRouter Blog](https://openrouter.ai/blog) RSS |
| `openai-blog` | append | feed | [OpenAI News](https://openai.com/news) RSS |
| `lilianweng-blog` | append | feed | [Lil'Log](https://lilianweng.github.io/) RSS |
| `anthropic-blog` | append | webpage | [Anthropic News](https://www.anthropic.com/news) |
| `bedrock-models` | append | webpage | [AWS Bedrock model list](https://docs.aws.amazon.com/bedrock/latest/userguide/model-cards.md) |
| `hy-news` | append | webpage | [Tencent Hy News](https://hy.tencent.com/) (JSON API) |
| `mimo-news` | append | webpage | [Xiaomi MiMo News](https://mimo.xiaomi.com/) (Rspress bundles) |
| `bigmodel-news` | append | webpage | [BigModel Docs Updates](https://docs.bigmodel.cn/cn/update/new-releases) (Mintlify markdown) |
| `minimax-news` | append | webpage | [MiniMax News](https://www.minimaxi.com/news) (JSON API + docs release notes) |
| `kimi-blog` | append | webpage | [Kimi Research Blog](https://www.kimi.com/blog/) (Moonshot AI) |
| `longcat-research` | append | webpage | [LongCat Research](https://longcat.ai/) (Meituan, SPA bundle) |
| `qwen-blog` | append | webpage | [Qwen Blog](https://qwen.ai/research) (Alibaba, page-config JSON API) |
| `gemini-blog` | append | webpage | [Gemini Blog](https://deepmind.google/blog/) (Google DeepMind, server-rendered cards) |
| `xai-news` | append | webpage | [xAI News](https://x.ai/blog) (server-rendered Next.js cards) |
| `dmit-stock` | state | webpage | [DMIT VPS stock](https://stock.qixi.me/) aggregator (notify on availability change) |

| Category | Sources |
|----------|---------|
| Changelogs & blogs | `cursor-changelog`, `cursor-blog`, `kiro-changelog`, `openrouter-blog`, `openai-blog`, `lilianweng-blog`, `anthropic-blog`, `hy-news`, `mimo-news`, `bigmodel-news`, `minimax-news`, `kimi-blog`, `longcat-research`, `qwen-blog`, `gemini-blog`, `xai-news` |
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
- Telegram / Feishu (notifications)

## One-click deploy

1. Click **Deploy to Cloudflare** above
2. Connect GitHub and Cloudflare, confirm resource names
3. After deploy, set optional secrets in Dashboard → Worker → **Settings → Variables and Secrets**:
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_CHAT_ID`
   - `FEISHU_WEBHOOK_URL`
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

D1_DATABASE_ID=<your-d1-uuid> pnpm run deploy:prod
```

First deploy auto-creates `beacon-crawl` and `beacon-crawl-dlq` queues.

## Environment variables

Set plain vars in `wrangler.jsonc` or secrets via `wrangler secret put`:

| Variable | Description | Required |
|----------|-------------|----------|
| `TELEGRAM_BOT_TOKEN` | Telegram bot token | No |
| `TELEGRAM_CHAT_ID` | Chat ID for alerts | No |
| `FEISHU_WEBHOOK_URL` | Feishu bot webhook URL | No |

Configure at least one channel for notifications. D1 / Queue / Browser use wrangler bindings.

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/sources` | List registered sources |
| GET | `/items` | Query items (`?source=&mode=&limit=&cursor=`) |
| GET | `/items/:id` | Item detail |
| GET | `/items/:id/states` | State history (state mode) |
| GET | `/items/:id/states/latest` | Latest state |
| POST | `/sources/:id/run` | Trigger crawl (enqueue; `?sync=1` inline; `?forceNotify=1` notify all fetched items) |
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
