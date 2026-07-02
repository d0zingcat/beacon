# Notify rate limiting: Queue-based optimization (backlog)

> Date: 2026-07-02  
> Status: **Backlog** — current production path uses D1 coordination (see below)

## Current implementation (shipped)

Feishu notifications are rate-limited synchronously inside `feishuTransport.send()`:

| Layer | Location | Role |
|-------|----------|------|
| In-isolate serial queue | `src/notify/rate-limiter.ts` | FIFO within one Worker isolate |
| Global slot reservation | `src/db/notify-rate-limit.ts` + `migrations/0002_notify_rate_limit.sql` | ~600 ms minimum interval across consumers |
| Retry on 11232 | `src/notify/feishu.ts` | Exponential backoff (1s → 2s → 4s), up to 3 retries |

Feishu custom-bot limits: **100 messages/minute**, **5 messages/second** per tenant per bot.

This is sufficient for moderate notification volume and keeps `dispatchNotifications` synchronous (including `markItemNotified` after a successful send).

## Why consider Queue later

The D1 approach works but has trade-offs:

- **Crawl blocks on notify** — `runSource` waits for all Feishu sends (and retries) before finishing.
- **D1 as a lock** — `notify_rate_limit` is coordination plumbing, not domain data.
- **No native DLQ for failed notifications** — failures are logged; retries are in-process only.
- **Scaling pressure** — Many events in one run (e.g. `forceNotify`) still work but extend crawl wall time.

A dedicated notify queue aligns with the existing `beacon-crawl` pattern: async delivery, built-in retry, DLQ.

## Proposed architecture

```
runSource / dispatchNotifications
        │
        ├─ Telegram (optional: stay sync — looser limits)
        │
        └─ enqueue NotifyMessage → beacon-notify
                    │
                    ▼
         notify consumer (max_concurrency: 1, max_batch_size: 1)
                    │
                    ├─ feishuTransport.sendOnce()  // no D1 slot / in-process queue
                    ├─ on 11232 → message.retry({ delaySeconds })
                    └─ on success + append event → markItemNotified(db, itemId)
```

**Do not** reuse `beacon-crawl` for rate limiting. That queue batches up to 5 crawl jobs and scales consumers for throughput — the opposite of what outbound webhooks need.

### Wrangler sketch

```jsonc
{
  "queues": {
    "producers": [
      { "binding": "CRAWL_QUEUE", "queue": "beacon-crawl" },
      { "binding": "NOTIFY_QUEUE", "queue": "beacon-notify" }
    ],
    "consumers": [
      { "queue": "beacon-crawl", "max_batch_size": 5, "max_retries": 3, "dead_letter_queue": "beacon-crawl-dlq" },
      {
        "queue": "beacon-notify",
        "max_batch_size": 1,
        "max_concurrency": 1,
        "max_retries": 5,
        "dead_letter_queue": "beacon-notify-dlq"
      }
    ]
  }
}
```

`max_concurrency: 1` gives a single global sender. It does **not** guarantee spacing; the consumer should still `sleep(600)` between sends **or** producers should stagger with `delaySeconds` when enqueueing a burst.

### Message shape

```typescript
interface NotifyMessage {
  channel: 'feishu' | 'telegram';
  text: string;
  /** For append events: mark notified only after successful delivery */
  itemId?: number;
  enqueuedAt: number;
}
```

`crawl_error` messages omit `itemId`. `state_change` may omit `itemId` if notification is not tied to the `notified` flag (current behavior only marks `append`).

### Worker routing

`src/index.ts` `queue()` handler branches on `batch.queue` (or message type) to call either `handleCrawlQueue` or `handleNotifyQueue`.

### Code changes (when implemented)

1. Add `NOTIFY_QUEUE` binding and `beacon-notify` (+ DLQ) in `wrangler.jsonc` / deploy config generator.
2. `dispatchNotifications` — enqueue per channel instead of `transport.send()` for Feishu (and optionally Telegram).
3. New `src/queue/notify-consumer.ts` — send, retry via `message.retry()`, `markItemNotified` on success.
4. Simplify `feishu.ts` — remove D1 slot + serial limiter; keep `sendOnce` + rate-limit error detection for `retry()`.
5. Drop `notify_rate_limit` table (migration `0003_drop_notify_rate_limit.sql`) once Queue path is verified in production.
6. Update tests: dispatch mocks queue send; notify consumer integration tests.

### Staggered enqueue (burst runs)

When enqueueing N messages from one crawl:

```typescript
for (let i = 0; i < events.length; i++) {
  await env.NOTIFY_QUEUE.send(payload, { delaySeconds: Math.floor(i * 0.6) });
}
```

Optional if consumer sleeps between sends; combining both is safest under platform-wide 11232 spikes.

## When to implement

Trigger any of:

- Crawl runs regularly exceed Worker wall time due to notification backlog.
- Frequent 11232 after D1 limiting (platform peak / multi-instance races).
- Need DLQ visibility for failed notifications.
- Desire to remove `notify_rate_limit` D1 coordination.

## Non-goals (for this optimization)

- Feishu rich cards or signing.
- Per-source or per-channel routing rules.
- Merging multiple events into one message (separate backlog item: notification aggregation).
