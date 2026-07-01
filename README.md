# beacon

信标 — 基于 Cloudflare Workers 的信息爬取、落库与提醒服务。

支持两类数据源：

- **append**：博客、changelog、新模型发布等只追加新条目的源
- **state**：VPS 库存、价格、可用性等状态会反复变化的源

## 技术栈

- Cloudflare Workers + TypeScript
- D1（SQLite）
- Queues（爬取任务解耦）
- Browser Rendering（`@cloudflare/playwright`）
- Cron Triggers（定时调度）
- Hono（HTTP API）
- Telegram Bot（通知）

## 本地开发

```bash
cd beacon
pnpm install
pnpm run cf-typegen
pnpm run typecheck
pnpm exec wrangler d1 migrations apply beacon-db --local
pnpm run dev
```

本地 `pnpm run dev` 使用 `wrangler.local.jsonc`（不含 Browser 绑定，便于本地 API 调试）。需要 Browser Rendering 时用 `pnpm run dev:remote`（需 `wrangler login`）。

## 环境变量

在 `wrangler.jsonc` 的 `vars` 中配置，或通过 `wrangler secret put` 设置：

- `TELEGRAM_BOT_TOKEN` — Telegram Bot Token
- `TELEGRAM_CHAT_ID` — 接收通知的 Chat ID
- `FEISHU_WEBHOOK_URL` — 飞书群机器人 Webhook URL（可选）

部署前需创建远程 D1 数据库并更新 `wrangler.jsonc` 中的 `database_id`：

```bash
pnpm exec wrangler d1 create beacon-db
pnpm exec wrangler d1 migrations apply beacon-db --remote
```

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

## 新增数据源

### 1. append 型（RSS 示例）

在 `src/sources/examples/` 新建文件，使用 `createSource` + `createFeedExtractor`：

```ts
import { createFeedExtractor } from '../extract/feed';
import { createSource } from '../factory';

createSource(
  { id: 'my-feed', name: 'My Feed', mode: 'append', schedule: '0 * * * *' },
  createFeedExtractor({ feedUrl: 'https://example.com/rss.xml' }),
);
```

在 `src/sources/examples/index.ts` 中添加 `import './my-feed'`。

### 2. state 型（Browser 示例）

```ts
import { createBrowserExtractor } from '../extract/browser';
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
  createBrowserExtractor({
    extract: async (ctx, page) => {
      await page.goto('https://example.com/vps');
      return [];
    },
  }),
);
```

## 占位源

当前注册了三个占位源（返回空数据，待接入真实抓取逻辑）：

- `cursor-changelog` — RSS / append
- `bedrock-models` — Browser / append
- `vps-stock` — Browser / state

## 目录结构

```
src/
├── index.ts          # Worker 入口（fetch / scheduled / queue）
├── router.ts         # Hono API
├── scheduler.ts      # Cron 调度
├── sources/          # 源注册与基类
├── examples/         # 示例/占位源
├── crawler/          # 爬取执行（runner / dedupe / state）
├── db/               # D1 仓储
├── notify/           # 通知（format / transport / dispatch）
├── extract/          # 抽取器（feed / webpage / browser）
└── queue/            # Queue 消费
```
