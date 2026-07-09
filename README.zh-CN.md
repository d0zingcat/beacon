# beacon

[English](./README.md) | **简体中文**

信标 — 基于 Cloudflare Workers 的信息爬取、落库与提醒服务。

支持两类数据源：

- **append**：博客、changelog、新模型发布等只追加新条目的源
- **state**：VPS 库存、价格、可用性等状态会反复变化的源

## 在线体验

项目已部署公共实例 **https://beacon.d0zingcat.workers.dev/** —— 无需自行部署即可直接使用。

```bash
# 健康检查
curl https://beacon.d0zingcat.workers.dev/health

# 列出支持的数据源
curl https://beacon.d0zingcat.workers.dev/sources

# 查询近期条目
curl "https://beacon.d0zingcat.workers.dev/items?limit=10"

# 聚合 RSS 订阅（按源过滤，默认包含所有 append 源）
curl "https://beacon.d0zingcat.workers.dev/feed"
curl "https://beacon.d0zingcat.workers.dev/feed?source=openai-blog&source=anthropic-blog&limit=20"

# 手动触发指定源的爬取
curl -X POST "https://beacon.d0zingcat.workers.dev/sources/cursor-changelog/run"
```

> 注意：公共实例已预配置所有支持的数据源，定时爬取会自动运行。共享实例不提供自定义通知渠道（Telegram / 飞书）。

## 支持的数据源

Beacon 内置 **16 个数据源**。部署后请执行 D1 迁移，以注册 RSS 订阅类源。

| ID | 模式 | 抽取器 | 监控内容 |
|----|------|--------|----------|
| `cursor-changelog` | append | webpage | [Cursor Changelog](https://cursor.com/changelog) |
| `cursor-blog` | append | webpage | [Cursor Blog](https://cursor.com/blog) |
| `kiro-changelog` | append | feed | [Kiro Changelog](https://kiro.dev/changelog) RSS |
| `openrouter-blog` | append | feed | [OpenRouter Blog](https://openrouter.ai/blog) RSS |
| `openai-blog` | append | feed | [OpenAI News](https://openai.com/news) RSS |
| `lilianweng-blog` | append | feed | [Lil'Log](https://lilianweng.github.io/) RSS |
| `anthropic-blog` | append | webpage | [Anthropic News](https://www.anthropic.com/news) |
| `bedrock-models` | append | webpage | [AWS Bedrock 模型列表](https://docs.aws.amazon.com/bedrock/latest/userguide/model-cards.md) |
| `hy-news` | append | webpage | [腾讯混元新闻](https://hy.tencent.com/)（JSON API） |
| `mimo-news` | append | webpage | [小米 MiMo 新闻](https://mimo.xiaomi.com/)（Rspress bundles） |
| `bigmodel-news` | append | webpage | [智谱开放平台更新](https://docs.bigmodel.cn/cn/update/new-releases)（Mintlify markdown） |
| `minimax-news` | append | webpage | [MiniMax 新闻与更新](https://www.minimaxi.com/news)（JSON API + 文档发布说明） |
| `kimi-blog` | append | webpage | [Kimi 研究博客](https://www.kimi.com/blog/)（月之暗面） |
| `longcat-research` | append | webpage | [LongCat 研究](https://longcat.ai/)（美团，SPA bundle） |
| `qwen-blog` | append | webpage | [Qwen 研究博客](https://qwen.ai/research)（阿里通义千问，page-config JSON API） |
| `gemini-blog` | append | webpage | [Gemini 博客](https://deepmind.google/blog/)（Google DeepMind，服务端渲染卡片） |
| `xai-news` | append | webpage | [xAI News](https://x.ai/blog)（服务端渲染 Next.js 卡片） |
| `dmit-stock` | state | webpage | [DMIT VPS 库存](https://stock.qixi.me/) 聚合页（可用性变化时通知） |

| 分类 | 数据源 |
|------|--------|
| Changelog 与博客 | `cursor-changelog`、`cursor-blog`、`kiro-changelog`、`openrouter-blog`、`openai-blog`、`lilianweng-blog`、`anthropic-blog`、`hy-news`、`mimo-news`、`bigmodel-news`、`minimax-news`、`kimi-blog`、`longcat-research`、`qwen-blog`、`gemini-blog`、`xai-news` |
| 模型目录 | `bedrock-models` |
| 基础设施 | `dmit-stock` |

定时调度（见 `wrangler.jsonc`）：博客与 RSS **每小时**；`bedrock-models` **每 6 小时**；`dmit-stock` **每 15 分钟**。

RSS 类源通过 D1 迁移写入（`migrations/0003_feed_source_config.sql`），启动时加载；网页类源定义在 `src/sources/examples/`。

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button?paid=true)](https://deploy.workers.cloudflare.com/?url=https://github.com/d0zingcat/beacon&paid=true)

> 本项目依赖 **D1**、**Queues** 与 **Browser Rendering**，需 [Workers 付费计划](https://developers.cloudflare.com/workers/platform/pricing/)。点击上方按钮后，Cloudflare 会自动 Fork 仓库、创建 D1 / Queue / Browser 绑定，并配置 Workers Builds 持续部署。

## 技术栈

- Cloudflare Workers + TypeScript
- D1（SQLite）
- Queues（爬取任务解耦）
- Browser Rendering（`@cloudflare/puppeteer`）
- Cron Triggers（定时调度）
- Hono（HTTP API）
- Telegram / 飞书（通知）

## 一键部署（推荐）

1. 点击顶部的 **Deploy to Cloudflare** 按钮
2. 连接 GitHub 与 Cloudflare 账号，确认资源名称后完成首次部署
3. 部署完成后，在 Cloudflare Dashboard → Worker → **Settings → Variables and Secrets** 中配置：
   - `TELEGRAM_BOT_TOKEN` — Telegram Bot Token（可选，不配置则跳过通知）
   - `TELEGRAM_CHAT_ID` — 接收通知的 Chat ID（可选）
   - `FEISHU_WEBHOOK_URL` — 飞书群机器人 Webhook URL（可选）
4. 若 D1 表未自动创建，在本地或 CI 中执行迁移：

```bash
pnpm exec wrangler d1 migrations apply beacon-db --remote
```

5. 访问 `https://<your-worker>.<account>.workers.dev/health` 验证部署

部署按钮会自动解析 `wrangler.jsonc` 中的绑定（D1、Queues、Browser、Cron），并在你的账号下创建对应资源。详见 [Deploy to Cloudflare 文档](https://developers.cloudflare.com/workers/platform/deploy-buttons/)。

## 本地开发

```bash
pnpm install
pnpm run cf-typegen
pnpm run typecheck
pnpm exec wrangler d1 migrations apply beacon-db --local
pnpm run dev
```

本地 `pnpm run dev` 使用 `wrangler.local.jsonc`（不含 Browser 绑定，便于本地 API 调试）。需要 Browser Rendering 时用 `pnpm run dev:remote`（需 `wrangler login`）。

### 快速验证

```bash
curl http://localhost:8787/health    # {"ok":true,"service":"beacon"}
curl http://localhost:8787/sources   # 列出已注册源
```

## GitHub Actions 部署（推荐）

推送到 `main` 或手动触发 **Deploy** workflow 后，CI 会自动测试、从 Secret 读取 `D1_DATABASE_ID` 生成部署配置并部署。

> Wrangler **不支持**在 `wrangler.jsonc` 里直接引用环境变量（见 [workers-sdk#12769](https://github.com/cloudflare/workers-sdk/issues/12769)）。仓库内 `wrangler.jsonc` 仅保留占位符 `local-beacon-db`；生产部署时 `scripts/generate-deploy-config.mjs` 读取 `D1_DATABASE_ID`，生成 gitignore 的 `.wrangler/deploy/wrangler.jsonc`，**不修改**已跟踪的配置文件。

在仓库 **Settings → Secrets and variables → Actions** 中配置：

| Secret | 说明 |
|--------|------|
| `CLOUDFLARE_API_TOKEN` | [API Token](https://dash.cloudflare.com/profile/api-tokens)，需 Workers Scripts、D1、Queues 等编辑权限 |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 账号 ID（Dashboard 右侧栏） |
| `D1_DATABASE_ID` | 远程 D1 的 UUID（`wrangler d1 list` 或 `d1 create` 返回值） |
| `FEISHU_WEBHOOK_URL` | 飞书群机器人 Webhook URL（可选；部署后由 CI 写入 Worker） |
| `TELEGRAM_BOT_TOKEN` | Telegram Bot Token（可选） |
| `TELEGRAM_CHAT_ID` | Telegram Chat ID（可选） |

GitHub Secrets **不会自动**进入 Worker 运行时环境。Deploy workflow 在每次部署后会执行 `wrangler secret put`，把上述通知类 Secret 同步到 Worker 的 `env`。请勿在 `wrangler.jsonc` 的 `vars` 里写通知变量——空字符串会在每次部署时覆盖 Worker secret。

### API Token 权限

建议从 **Edit Cloudflare Workers** 模板创建 Token，并额外勾选：

- **D1** — Edit
- **Queues** — Edit
- **Workers Observability** — Edit（推荐）

Token 作用域限定在当前账号即可。

## 手动部署

适用于已有 Cloudflare 账号、希望自行管理资源的场景。

```bash
pnpm install
pnpm exec wrangler login

# 创建远程 D1（首次）
pnpm exec wrangler d1 create beacon-db
pnpm exec wrangler d1 migrations apply beacon-db --remote

# 配置通知（至少配置一种，或全部留空以禁用通知）
pnpm exec wrangler secret put TELEGRAM_BOT_TOKEN
pnpm exec wrangler secret put TELEGRAM_CHAT_ID
pnpm exec wrangler secret put FEISHU_WEBHOOK_URL   # 可选

# 通过环境变量生成部署配置（不改动 wrangler.jsonc）
D1_DATABASE_ID=<your-d1-uuid> pnpm run deploy:prod
```

首次 `deploy` 时 Wrangler 会自动创建 `beacon-crawl` 与 `beacon-crawl-dlq` 队列。

## 环境变量

在 `wrangler.jsonc` 的 `vars` 中配置明文变量，或通过 `wrangler secret put` 设置敏感值：

| 变量 | 说明 | 必填 |
|------|------|------|
| `TELEGRAM_BOT_TOKEN` | Telegram Bot Token | 否 |
| `TELEGRAM_CHAT_ID` | 接收通知的 Chat ID | 否 |
| `FEISHU_WEBHOOK_URL` | 飞书群机器人 Webhook URL | 否 |
| `RUN_TOKEN` | 用于保护 `POST /sources/:id/run` 的 Bearer Token | 否 |

至少配置一种通知渠道，新条目或状态变化才会推送。D1 / Queue / Browser 通过 wrangler bindings 注入，无需单独配置。

### RUN_TOKEN

设置 `RUN_TOKEN` 后，`POST /sources/:id/run` 需要通过 `Authorization: Bearer <token>` 请求头或 `?token=<token>` 查询参数传入该 Token，否则返回 `401 Unauthorized`。未设置时接口保持开放（默认行为）。

```bash
curl -X POST "https://<your-worker>.<account>.workers.dev/sources/cursor-changelog/run?token=your-secret-token"
# 或
curl -X POST "https://<your-worker>.<account>.workers.dev/sources/cursor-changelog/run" \
  -H "Authorization: Bearer your-secret-token"
```

通过 `wrangler secret put RUN_TOKEN` 进行设置。

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查 |
| GET | `/sources` | 列出已注册源 |
| GET | `/items` | 查询条目（`?source=&mode=&limit=&cursor=`） |
| GET | `/items/:id` | 单条详情 |
| GET | `/items/:id/states` | 状态历史（state 模式） |
| GET | `/items/:id/states/latest` | 最新状态 |
| GET | `/feed` | 聚合 RSS 订阅（`append` 类源；`?source=` 过滤，可重复；`?limit=`、`?sort=published_at|created_at|id|updated_at`、`?order=asc|desc`） |
| POST | `/sources/:id/run` | 手动触发爬取（入队；`?sync=1` 同步执行；`?forceNotify=1` 对本次拉取的全部条目发通知；设置 `RUN_TOKEN` 后需携带 Token） |
| GET | `/runs` | 运行日志 |

无新条目时验证通知渠道，可加 `forceNotify=1`（对本次拉取的每条数据各发一条消息）：

```bash
curl -X POST "https://beacon.example.workers.dev/sources/bedrock-models/run?sync=1&forceNotify=1"
```

响应中的 `itemsNotified` 表示本次实际发送的通知条数。

## 新增数据源

### 1. append 型（RSS 示例）

在 `src/sources/examples/` 新建文件，使用 `createSource` + `createFeedExtractor`：

```ts
import { createFeedExtractor } from '../../extract/feed';
import { createSource } from '../factory';

createSource(
  { id: 'my-feed', name: 'My Feed', mode: 'append', schedule: '0 * * * *' },
  createFeedExtractor({ feedUrl: 'https://example.com/rss.xml' }),
);
```

在 `src/sources/examples/index.ts` 中添加 `import './my-feed'`。

### 2. append 型（网页 / Markdown 示例）

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

### 3. state 型（Browser 示例）

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
      // 使用 ctx.browser 进行页面抓取，返回 RawItem[]
      return [];
    },
  },
);
```

## 架构概览

```
Cron (scheduled) → 入队 CRAWL_QUEUE
                      ↓
Queue Consumer → runSource(sourceId)
                      ↓
              Source Registry + Extractor
                      ↓
         ┌────────────┴────────────┐
    append 模式                  state 模式
    hash 去重 → items           对比 state → states 快照
         └────────────┬────────────┘
                      ↓
         Telegram / 飞书通知（可选）
                      ↓
              Hono API 查询
```

## 目录结构

```
src/
├── index.ts          # Worker 入口（fetch / scheduled / queue）
├── router.ts         # Hono API
├── scheduler.ts      # Cron 调度
├── sources/          # 源注册与工厂
│   └── examples/     # 示例与已接入源
├── crawler/          # 爬取执行（runner / dedupe / state）
├── db/               # D1 仓储
├── notify/           # 通知（format / transport / dispatch）
├── extract/          # 抽取器（feed / webpage / browser）
└── queue/            # Queue 消费
migrations/           # D1 数据库迁移
.github/workflows/    # CI + Deploy（Node 24）
scripts/              # generate-deploy-config.mjs
```

## 相关文档

- [README.md](./README.md) — 英文 readme
- [HANDOFF.md](./HANDOFF.md) — 项目交接与详细设计说明（中文）
- [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/)
- [Deploy to Cloudflare 按钮](https://developers.cloudflare.com/workers/platform/deploy-buttons/)
