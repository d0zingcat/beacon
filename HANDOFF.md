# beacon 项目交接文档

> 最后更新：2026-07-01  
> 阶段：**首个数据源已接入**（`cursor-changelog` HTML 抓取 + append 落库），其余源仍为占位。

## 1. 项目定位

`beacon`（信标）是部署在 Cloudflare Workers 上的信息监控服务，用于：

- 爬取并落库：changelog、博客、模型列表、VPS 库存等
- 状态变化或新条目触发 Telegram 提醒
- 通过 HTTP API 查询，供后续专属网页消费

支持两类数据源：

| 模式 | 用途 | 触发提醒条件 |
|------|------|--------------|
| `append` | 博客、changelog、新模型发布 | 出现新条目（hash 去重） |
| `state` | VPS 库存、价格、可用性 | 状态相对上次发生变化 |

## 2. 技术栈

| 组件 | 选型 |
|------|------|
| 运行时 | Cloudflare Workers + TypeScript |
| HTTP 框架 | Hono |
| 数据库 | D1（SQLite） |
| 任务队列 | Cloudflare Queues |
| 定时调度 | Cron Triggers |
| 浏览器自动化 | `@cloudflare/playwright`（非标准 `playwright` 包） |
| 通知 | Telegram Bot API |

## 3. 架构与数据流

```
Cron (scheduled) → 入队 CRAWL_QUEUE
                      ↓
Queue Consumer → runSource(sourceId)
                      ↓
              Source Registry (rss / browser)
                      ↓
         ┌────────────┴────────────┐
    append 模式                  state 模式
    hash 去重 → items           对比 state → states 快照
         └────────────┬────────────┘
                      ↓
              Telegram 通知（可选）
                      ↓
              Hono API 查询
```

### Worker 三入口（`src/index.ts`）

- `fetch` — Hono API
- `scheduled` — Cron 触发，将所有源入队
- `queue` — 消费爬取任务，调用 `runSource`

## 4. 目录结构

```
beacon/
├── HANDOFF.md              # 本文档
├── README.md               # 使用说明
├── wrangler.jsonc          # 生产配置（含 Browser 绑定）
├── wrangler.local.jsonc    # 本地 API 调试（无 Browser 绑定）
├── migrations/0001_init.sql
└── src/
    ├── index.ts            # Worker 入口
    ├── router.ts           # Hono 路由
    ├── scheduler.ts        # Cron → 入队
    ├── env.ts              # CrawlMessage 类型
    ├── sources/
    │   ├── types.ts        # Source / RawItem / NotifyEvent
    │   ├── registry.ts     # 源注册表（无 side-effect import）
    │   ├── rss.ts          # RSS 基类
    │   ├── browser.ts      # Playwright 基类 + withBrowserPage
    │   └── examples/       # 占位源（在 index.ts 中统一加载）
    ├── crawler/
    │   ├── runner.ts       # 爬取主流程
    │   ├── dedupe.ts       # SHA-1 去重
    │   └── state.ts        # state 模式对比与快照
    ├── db/
    │   ├── client.ts       # D1 封装
    │   └── repo.ts         # 仓储层
    ├── notify/
    │   └── telegram.ts     # Telegram 推送
    └── queue/
        └── consumer.ts     # Queue 消费
```

## 5. 数据库 Schema

| 表 | 说明 |
|----|------|
| `sources` | 源元数据（id、kind、mode、最近运行状态） |
| `items` | 实体条目；state 模式含 `state_json` / `prev_state_json` |
| `states` | state 模式每次爬取的状态快照（保留历史） |
| `run_log` | 每次爬取运行日志 |

Migration 文件：`migrations/0001_init.sql`

## 6. 已注册的占位源

| ID | 类型 | 模式 | 状态 |
|----|------|------|------|
| `cursor-changelog` | rss | append | 已接入 HTML 抓取（cursor.com/changelog） |
| `bedrock-models` | browser | append | 占位，`fetch` 返回 `[]` |
| `vps-stock` | browser | state | 占位，`fetch` 返回 `[]` |

源在 `src/sources/examples/` 定义，由 `src/sources/examples/index.ts` 聚合，在 `src/index.ts` 首行 `import './sources/examples'` 加载（避免 registry 循环依赖）。

## 7. API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查 |
| GET | `/sources` | 列出已注册源 |
| GET | `/items` | 分页查询（`?source=&mode=&limit=&cursor=`） |
| GET | `/items/:id` | 单条详情 |
| GET | `/items/:id/states` | 状态历史 |
| GET | `/items/:id/states/latest` | 最新状态 |
| POST | `/sources/:id/run` | 手动触发（入队） |
| GET | `/runs` | 运行日志 |

## 8. 本地开发

```bash
cd beacon
pnpm install
pnpm run cf-typegen
pnpm run typecheck
pnpm exec wrangler d1 migrations apply beacon-db --local
pnpm run dev          # 使用 wrangler.local.jsonc，仅 API 调试
pnpm run dev:remote   # 含 Browser 绑定，需 wrangler login
```

### 验证命令（已通过）

```bash
pnpm run typecheck                              # ✅
pnpm exec wrangler d1 migrations apply beacon-db --local  # ✅
curl http://localhost:8787/health              # {"ok":true,"service":"beacon"}
curl http://localhost:8787/sources             # 返回 3 个占位源
```

## 9. 部署 checklist

- [ ] `wrangler login`
- [ ] `pnpm exec wrangler d1 create beacon-db`，将返回的 `database_id` 写入 `wrangler.jsonc`
- [ ] `pnpm exec wrangler d1 migrations apply beacon-db --remote`
- [ ] 创建 Queues：`beacon-crawl`、`beacon-crawl-dlq`（首次 deploy 时 wrangler 可能自动创建）
- [ ] 配置 `TELEGRAM_BOT_TOKEN`、`TELEGRAM_CHAT_ID`（建议 `wrangler secret put`）
- [ ] `pnpm run deploy`（使用 `wrangler.jsonc`）

## 10. 新增数据源

### append 型（RSS）

1. 在 `src/sources/examples/` 新建文件
2. 使用 `createRssSource(...)` 注册
3. 在 `src/sources/examples/index.ts` 添加 `import './your-source'`

### state 型（Browser + Playwright）

1. 同上新建文件
2. 使用 `createBrowserSource(...)` + `withBrowserPage`
3. 可选实现 `diff(prev, next)` 自定义变化判定

```ts
import { createBrowserSource, withBrowserPage } from '../browser';

createBrowserSource(
  { id: 'my-stock', name: 'My VPS', mode: 'state', schedule: '*/15 * * * *' },
  { url: 'https://example.com/vps' },
  async (ctx, config) =>
    withBrowserPage(ctx, async (page) => {
      await page.goto(config.url);
      // 解析页面，返回 RawItem[]，每项带 state 字段
      return [];
    }),
);
```

## 11. 已知限制与 TODO

### 已知限制

- **Scheduler 简化**：每次 cron tick 将所有源入队，未按各源 `schedule` 精确匹配
- **本地 Browser**：`wrangler.local.jsonc` 不含 Browser 绑定；本地 Playwright 需 `dev:remote` 或升级 wrangler 4.x
- **wrangler 版本**：当前 3.x，`compatibility_date` 在本地会 fallback 到 runtime 支持的日期
- **Playwright 约束**：Workers 内只能用 `@cloudflare/playwright`，不支持 Playwright Test、Firefox、录屏等

### 待办（按优先级）

1. ~~接入 `cursor-changelog` 真实抓取，跑通 append 全流程~~（已完成；Telegram 待配置）
2. 配置远程 D1 并部署
3. 接入 `bedrock-models`（Browser / append）
4. 接入 `vps-stock`（Browser / state）
5. Scheduler 按 per-source cron 过滤
6. API 鉴权、通知限流、Web 前端

## 12. 关键设计决策

| 决策 | 理由 |
|------|------|
| Playwright 而非 Puppeteer | 团队偏好；CF 官方支持 `@cloudflare/playwright`，本地 dev 体验更好 |
| items + states 双表 | append 与 state 语义分离，state 保留历史轨迹 |
| Queues 解耦爬取 | 避免 Cron  handler 超时，支持重试与 DLQ |
| 源注册 side-effect 模式 | 新增源只需加文件 + import，不改核心逻辑 |
| `wrangler.local.jsonc` | 本地无 Browser 绑定时仍可调试 API |

## 13. 环境变量

| 变量 | 说明 |
|------|------|
| `TELEGRAM_BOT_TOKEN` | Telegram Bot Token |
| `TELEGRAM_CHAT_ID` | 接收通知的 Chat ID |

D1 / Queue / Browser 通过 wrangler bindings 注入，非环境变量。

## 14. 联系人 / 上下文

- 仓库：`https://github.com/d0zingcat/beacon`
- 原始需求：监控 Cursor changelog、AWS Bedrock 模型、VPS 库存等，落库 + API + Telegram 提醒
