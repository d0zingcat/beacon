# beacon 通知与抽取抽象设计

> 日期：2026-07-01  
> 状态：待评审

## 背景

beacon 当前存在两类耦合问题：

1. **通知层**：内容更新（`append` / `state_change`）与系统告警（`crawl_error`）走不同函数；格式化、发送、DB 副作用混在 `telegram.ts` 中。
2. **抽取层**：`cursor-changelog` 用 `createRssSource` 抓取 HTML，`kind` 误标为 `rss`；平台解析逻辑与源注册耦合，难以在 feed / 网页 / 浏览器场景间复用。

## 目标

- 统一通知管线：所有事件类型经同一 `dispatchNotifications` 扇出。
- 多通道发送：Telegram + 飞书 Webhook；配置了哪些通道就发哪些，全部事件扇出（内容更新 + 抓取失败告警）。
- 抽取器抽象：`feed` / `webpage` / `browser` 三种 Extractor，Source 仅组合元数据 + Extractor。
- 保持 crawler、registry、DB schema 主流程不变。

## 非目标

- 按事件类型或通道做分流路由。
- 飞书富文本卡片、消息签名验证。
- API 鉴权、Scheduler per-source cron、新数据源接入。

---

## 一、通知层

### 1.1 目录结构

```
src/notify/
├── types.ts       # NotificationEvent 联合类型
├── format.ts      # formatNotification(event) → string（纯函数）
├── transport.ts   # NotifierTransport 接口 + createTransports(env)
├── telegram.ts    # Telegram 实现
├── feishu.ts      # 飞书 Webhook 实现
└── dispatch.ts    # dispatchNotifications(env, db, events[])
```

### 1.2 事件类型

从 `src/sources/types.ts` 迁出，扩展为统一联合类型：

```typescript
type NotificationEvent =
  | {
      kind: 'append';
      sourceId: string;
      sourceName: string;
      itemId: number;
      title: string;
      url?: string;
      summary?: string;
    }
  | {
      kind: 'state_change';
      sourceId: string;
      sourceName: string;
      itemId: number;
      title: string;
      url?: string;
      diff?: Record<string, unknown>;
    }
  | {
      kind: 'crawl_error';
      sourceId: string;
      sourceName: string;
      error: string;
      /** 为 true 时跳过发送（等同现有 previousStatus === 'error' 去重） */
      suppress?: boolean;
    };
```

`NotifyEvent` 类型删除；`crawler/runner.ts` 与 `crawler/state.ts` 改为产出 `NotificationEvent`。

### 1.3 Transport 接口

```typescript
interface NotifierTransport {
  readonly id: 'telegram' | 'feishu';
  isConfigured(env: Env): boolean;
  send(env: Env, text: string): Promise<void>;
}
```

`createTransports(env)` 返回 `[telegramTransport, feishuTransport].filter(t => t.isConfigured(env))`。

### 1.4 环境变量

| 变量 | 说明 |
|------|------|
| `TELEGRAM_BOT_TOKEN` | 已有 |
| `TELEGRAM_CHAT_ID` | 已有 |
| `FEISHU_WEBHOOK_URL` | 飞书群自定义机器人 Webhook 完整 URL |

未配置的通道静默跳过，不抛错。

### 1.5 格式化（format.ts）

保留现有文本风格，按 `kind` 分支：

| kind | 前缀示例 |
|------|----------|
| `append` | `[beacon] 新条目 · {sourceName}` |
| `state_change` | `[beacon] 状态变化 · {sourceName}` |
| `crawl_error` | `[beacon] 抓取失败 · {sourceName}` |

Telegram 与飞书共用同一格式化结果。

### 1.6 通道实现

**Telegram**（`telegram.ts`）  
- `POST https://api.telegram.org/bot{token}/sendMessage`  
- `disable_web_page_preview: true`  
- 逻辑从现有 `sendTelegramMessage` 迁移

**飞书**（`feishu.ts`）  
- `POST {FEISHU_WEBHOOK_URL}`  
- Body: `{ "msg_type": "text", "content": { "text": "..." } }`  
- 非 2xx 或响应体 `code !== 0`（若存在）视为失败并抛错

### 1.7 调度（dispatch.ts）

```
for each event in events:
  if event.kind === 'crawl_error' && event.suppress: continue
  text = formatNotification(event)
  results = Promise.allSettled(transports.map(t => t.send(env, text)))
  if any fulfilled && event.kind === 'append':
    markItemNotified(db, event.itemId)
```

规则：

- **扇出**：每条通知发往所有已配置通道。
- **失败隔离**：单通道失败记录日志，不阻断其他通道。
- **副作用**：`append` 事件在**至少一个通道发送成功**后执行 `markItemNotified`；全部失败则不标记。
- **告警去重**：`crawl_error` 的 `suppress: true` 在 dispatch 层跳过（runner 传入 `suppress: previousStatus === 'error'`）。

### 1.8 runner 调用变更

```typescript
// 替换 dispatchNotifyEvents + notifyCrawlError
await dispatchNotifications(env, db, [
  ...contentEvents,
  { kind: 'crawl_error', sourceId, sourceName, error: message, suppress: previousStatus === 'error' },
]);
```

错误路径不再单独调用 `notifyCrawlError`。

### 1.9 测试

| 文件 | 覆盖 |
|------|------|
| `notify/format.test.ts` | 三种 kind 的文本格式 |
| `notify/feishu.test.ts` | payload 构造、错误响应处理 |
| `notify/dispatch.test.ts` | 扇出、suppress、markItemNotified 条件（mock transport） |
| 迁移 `telegram.test.ts` | 适配新结构 |

---

## 二、抽取层

### 2.1 目录结构

```
src/extract/
├── types.ts       # Extractor 接口、ExtractContext（复用 SourceContext）
├── feed.ts        # createFeedExtractor + parseRssFeed
├── webpage.ts     # createWebpageExtractor
└── browser.ts     # createBrowserExtractor + withBrowserPage（从 sources/browser.ts 迁移）

src/sources/
├── types.ts       # Source（元数据 + extractor 委托 fetch）
├── factory.ts     # createSource(base, extractor)
├── registry.ts    # 不变
├── rss.ts         # @deprecated 薄 wrapper → createSource + feed
└── browser.ts     # @deprecated 薄 wrapper → createSource + browser
```

### 2.2 Extractor 接口

```typescript
type ExtractorKind = 'feed' | 'webpage' | 'browser';

interface Extractor {
  kind: ExtractorKind;
  extract(ctx: SourceContext): Promise<RawItem[]>;
}
```

### 2.3 工厂函数

**createFeedExtractor**

```typescript
createFeedExtractor({
  feedUrl: string;
  headers?: Record<string, string>;
  parse?: (xml: string) => RawItem[];  // 默认 parseRssFeed
})
```

流程：`ctx.fetch(feedUrl)` → `parse(xml)` → `RawItem[]`

**createWebpageExtractor**

```typescript
createWebpageExtractor({
  url: string;
  headers?: Record<string, string>;
  parse: (html: string) => RawItem[];
})
```

流程：`ctx.fetch(url)` → `parse(html)` → `RawItem[]`

**createBrowserExtractor**

```typescript
createBrowserExtractor({
  url: string;
  extract: (ctx: SourceContext, page: Page) => Promise<RawItem[]>;
})
```

流程：`withBrowserPage(ctx, page => extract(ctx, page))` → `RawItem[]`

### 2.4 Source 组合

```typescript
function createSource(
  base: {
    id: string;
    name: string;
    mode: SourceMode;
    schedule: string;
    normalize?: Source['normalize'];
    diff?: Source['diff'];
  },
  extractor: Extractor,
): Source
```

`Source.kind` 取自 `extractor.kind`（不再手写）。  
`Source.fetch(ctx)` 委托 `extractor.extract(ctx)`。

### 2.5 示例源迁移

| 源 | 迁移后 |
|----|--------|
| `kiro-changelog` | `createSource` + `createFeedExtractor`（自定义 headers） |
| `cursor-changelog` | `createSource` + `createWebpageExtractor`（`parse: parseCursorChangelogHtml`），`kind` 变为 `webpage` |
| `bedrock-models` | `createSource` + `createBrowserExtractor` |
| `vps-stock` | `createSource` + `createBrowserExtractor`（`mode: 'state'`） |

`parseCursorChangelogHtml` 保留在 `examples/cursor-changelog.ts`，作为 parser 注入。

### 2.6 向后兼容

`createRssSource` / `createBrowserSource` 保留为 deprecated 薄 wrapper，内部调用 `createSource` + 对应 Extractor，避免外部引用断裂。examples 直接迁移到新 API。

### 2.7 测试

| 文件 | 覆盖 |
|------|------|
| `extract/feed.test.ts` | `parseRssFeed`（可从现有测试迁移） |
| `examples/cursor-changelog.test.ts` | 不变，测 parser |
| `examples/kiro-changelog.test.ts` | 不变 |

---

## 三、数据流（整体）

```mermaid
flowchart TD
  Cron[Cron / Queue] --> Runner[runSource]
  Runner --> Extractor[Extractor.extract]
  Extractor --> RawItems[RawItem[]]
  RawItems --> Process[dedupe / state]
  Process --> Events[NotificationEvent[]]
  Events --> Dispatch[dispatchNotifications]
  Dispatch --> Format[formatNotification]
  Format --> TG[Telegram]
  Format --> FS[Feishu]
  TG --> DB[markItemNotified]
  FS --> DB
```

---

## 四、配置变更

`wrangler.jsonc` 与 `wrangler.local.jsonc` 的 `vars` 增加：

```json
"FEISHU_WEBHOOK_URL": ""
```

运行 `pnpm run cf-typegen` 更新 `worker-configuration.d.ts`。

`README.md` / `HANDOFF.md` 环境变量表补充 `FEISHU_WEBHOOK_URL` 说明。

---

## 五、实施顺序

1. **通知层**：types → format → transport → telegram/feishu → dispatch → runner 切换 → 测试
2. **抽取层**：extract/types → feed/webpage/browser → factory → 迁移 examples → deprecated wrappers → 测试
3. **文档**：README、HANDOFF 环境变量与新增源示例更新

每步完成后 `pnpm run typecheck` 与 `pnpm test` 通过。

---

## 六、风险与限制

- 飞书 text 消息有长度上限（约 30KB）；超长 `state_change` diff 可能被截断——首版不处理，后续可加截断逻辑。
- 双通道部分成功时 `markItemNotified` 仍执行，避免重复推送；单通道用户需注意另一通道可能漏收。
- `Source.kind` 从 `rss` 改为 `webpage`（cursor）仅影响 DB `sources.kind` 新写入值，无 migration 需求。

---

## 七、验收标准

- [ ] `append` / `state_change` / `crawl_error` 均经 `dispatchNotifications` 发送
- [ ] 仅配置 Telegram、仅配置飞书、两者都配置、都不配置，四种情况行为正确
- [ ] `crawl_error` 连续失败时第二次起 suppress，不重复告警
- [ ] `kiro-changelog` 使用 feed extractor，`cursor-changelog` 使用 webpage extractor（kind 正确）
- [ ] 所有现有测试通过，新增 format/feishu/dispatch 测试通过
- [ ] `pnpm run typecheck` 通过
