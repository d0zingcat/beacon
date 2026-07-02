# beacon 项目交接文档

> [English README](./README.md) | [中文 README](./README.zh-CN.md)

> 最后更新：2026-07-02  
> 阶段：**8 个数据源已接入**（7 个 append + 1 个 state + 通知限流），覆盖 changelog、博客、模型列表与 VPS 库存。

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
| 浏览器自动化 | `@cloudflare/puppeteer`（Browser Rendering） |
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
              Telegram / 飞书通知（可选；飞书经 D1 限流）
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
    │   ├── browser.ts      # Puppeteer 基类 + withBrowserPage
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
| `notify_rate_limit` | 通知通道全局限流（`channel` → `next_available_at`） |

Migration 文件：`migrations/0001_init.sql`、`migrations/0002_notify_rate_limit.sql`

## 6. 已注册数据源

| ID | 模式 | 抽取器 | 说明 |
|----|------|--------|------|
| `cursor-changelog` | append | webpage | cursor.com/changelog |
| `cursor-blog` | append | webpage | cursor.com/blog |
| `kiro-changelog` | append | feed | kiro.dev/changelog RSS |
| `openrouter-blog` | append | feed | openrouter.ai/blog RSS |
| `openai-blog` | append | feed | openai.com/news RSS |
| `anthropic-blog` | append | webpage | anthropic.com/news |
| `bedrock-models` | append | webpage | AWS Bedrock model-cards.md |
| `dmit-stock` | state | webpage | stock.qixi.me DMIT 库存聚合 |

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
curl http://localhost:8787/sources             # 返回 8 个已注册源
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
2. 使用 `createSource` + `createFeedExtractor` 注册
3. 在 `src/sources/examples/index.ts` 添加 `import './your-source'`

### append / state 型（网页）

1. 同上新建文件
2. 使用 `createSource` + `createWebpageExtractor`（state 模式可附加 `diff`）
3. 在 `index.ts` 添加 import

### state 型（Browser + Puppeteer）

需要 JS 渲染的页面使用 `kind: 'browser'` extractor；当前 `dmit-stock` 使用第三方聚合页 HTTP 抓取，browser extractor 保留供后续源使用。

## 11. 已知限制与 TODO

### 已知限制

- **Scheduler 简化**：每次 cron tick 将所有源入队，未按各源 `schedule` 精确匹配
- **本地 Browser**：`wrangler.local.jsonc` 不含 Browser 绑定；本地 Browser Rendering 需 `dev:remote` 或升级 wrangler 4.x
- **wrangler 版本**：当前 3.x，`compatibility_date` 在本地会 fallback 到 runtime 支持的日期
- **Browser Rendering**：Workers 内通过 `@cloudflare/puppeteer` 使用 Cloudflare Browser Rendering；不支持完整 Node Puppeteer 生态（如本地 Chrome 路径、录屏等）

### 待办（按优先级）

1. ~~接入 `cursor-changelog` 真实抓取，跑通 append 全流程~~（已完成）
2. ~~接入 `bedrock-models`、`kiro-changelog`、博客源、`dmit-stock`~~（已完成）
3. 配置远程 D1 并部署
4. Scheduler 按 per-source cron 过滤
5. API 鉴权、Web 前端
6. ~~通知限流（飞书）~~ — 已用 D1 全局 slot + 串行队列 + 11232 重试；Queue 异步方案见 [notify-queue-rate-limit-design.md](./docs/superpowers/specs/2026-07-02-notify-queue-rate-limit-design.md)
7. 通用 VPS 库存监控（browser / state，替代早期 `vps-stock` 占位）

## 12. 关键设计决策

| 决策 | 理由 |
|------|------|
| Puppeteer（Browser Rendering） | DMIT 等需 JS 渲染的页面；当前 `dmit-stock` 使用第三方聚合页 HTTP 抓取，browser extractor 保留供后续源使用 |
| items + states 双表 | append 与 state 语义分离，state 保留历史轨迹 |
| Queues 解耦爬取 | 避免 Cron  handler 超时，支持重试与 DLQ |
| 源注册 side-effect 模式 | 新增源只需加文件 + import，不改核心逻辑 |
| `wrangler.local.jsonc` | 本地无 Browser 绑定时仍可调试 API |

## 13. 环境变量

| 变量 | 说明 |
|------|------|
| `TELEGRAM_BOT_TOKEN` | Telegram Bot Token |
| `TELEGRAM_CHAT_ID` | 接收通知的 Chat ID |
| `FEISHU_WEBHOOK_URL` | 飞书群机器人 Webhook URL（可选） |

D1 / Queue / Browser 通过 wrangler bindings 注入，非环境变量。

## 14. 联系人 / 上下文

- 仓库：`https://github.com/d0zingcat/beacon`
- 原始需求：监控 Cursor changelog、AWS Bedrock 模型、VPS 库存等，落库 + API + Telegram 提醒
