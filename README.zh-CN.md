# beacon

[English](./README.md) | **简体中文**

信标 — 基于 Cloudflare Workers 的信息爬取、落库与提醒服务。

支持两类数据源：

- **append**：博客、changelog、新模型发布等只追加新条目的源
- **state**：VPS 库存、价格、可用性等状态会反复变化的源

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button?paid=true)](https://deploy.workers.cloudflare.com/?url=https://github.com/d0zingcat/beacon&paid=true)

> 本项目依赖 **D1**、**Queues** 与 **Browser Rendering**，需 [Workers 付费计划](https://developers.cloudflare.com/workers/platform/pricing/)。点击上方按钮后，Cloudflare 会自动 Fork 仓库、创建 D1 / Queue / Browser 绑定，并配置 Workers Builds 持续部署。

## 技术栈

- Cloudflare Workers + TypeScript
- D1（SQLite）
- Queues（爬取任务解耦）
- Browser Rendering（`@cloudflare/playwright`）
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

至少配置一种通知渠道，新条目或状态变化才会推送。D1 / Queue / Browser 通过 wrangler bindings 注入，无需单独配置。

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查 |
| GET | `/sources` | 列出已注册源 |
| GET | `/items` | 查询条目（`?source=&mode=&limit=&cursor=`） |
| GET | `/items/:id` | 单条详情 |
| GET | `/items/:id/states` | 状态历史（state 模式） |
| GET | `/items/:id/states/latest` | 最新状态 |
| POST | `/sources/:id/run` | 手动触发爬取（入队） |
| GET | `/runs` | 运行日志 |

## 已注册数据源

| ID | 模式 | 抓取方式 | 状态 |
|----|------|----------|------|
| `cursor-changelog` | append | HTML 页面解析（cursor.com/changelog） | 已接入 |
| `kiro-changelog` | append | RSS（kiro.dev/changelog） | 已接入 |
| `bedrock-models` | append | Markdown 页面解析（AWS Bedrock 模型列表） | 已接入 |
| `vps-stock` | state | Browser Rendering | 占位，待接入真实抓取 |

源在 `src/sources/examples/` 定义，由 `src/sources/examples/index.ts` 聚合加载。

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
```

## 相关文档

- [HANDOFF.md](./HANDOFF.md) — 项目交接与详细设计说明（中文）
- [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/)
- [Deploy to Cloudflare 按钮](https://developers.cloudflare.com/workers/platform/deploy-buttons/)
