# Public Web and Feishu Subscriptions — Design

**Date:** 2026-07-09
**Status:** Draft for review

## Goal

Add a public web experience for browsing Beacon sources and recent items, plus a login-gated subscription center where users can connect their own Feishu custom bot webhook and subscribe to selected sources.

## Product scope

Beacon should become usable without curl or self-hosting knowledge:

- Anonymous users can browse supported sources.
- Anonymous users can browse recent messages across all sources and within one source.
- Logged-in users can save a Feishu webhook after Beacon verifies it with a test message.
- Logged-in users can choose which sources should send updates to that webhook.
- Logged-in users can pause, resume, or delete their subscriptions.

The first release should not add billing, teams, source creation, OAuth, per-user custom crawlers, or a separate frontend deployment.

## Existing context

The current Worker already exposes the core read APIs:

| Existing API | Use in web product |
|--------------|--------------------|
| `GET /sources` | Public source directory |
| `GET /sources/:id` | Source metadata and run status |
| `GET /items?source=&mode=&limit=&cursor=` | Public recent item lists |
| `GET /items/:id` | Public item detail |
| `GET /feed?source=` | RSS fallback and copyable feed URLs |

Notifications are currently global. `dispatchNotifications()` creates configured transports from Worker environment variables, and `feishuTransport` sends to `env.FEISHU_WEBHOOK_URL`. That behavior should remain available for existing deployments, but user subscriptions need a separate dispatch path.

## Recommended architecture

Serve a small first-party web UI from the existing Hono Worker. Keep the app same-origin with the API, D1 database, crawler, and notification code.

This avoids a second deployment surface, avoids CORS complexity, and fits the current project shape. The UI can begin as server-rendered HTML with progressive JavaScript for filters, source selection, and form submission. If the interface later becomes complex, it can move to Cloudflare Pages or a bundled frontend without changing the domain model.

## Routes

### Public routes

| Route | Purpose |
|-------|---------|
| `GET /` | Public recent item stream with source filter controls |
| `GET /browse/sources` | Public source directory |
| `GET /browse/sources/:id` | Public source detail and latest items |
| `GET /browse/items/:id` | Public item detail page |
| `GET /feed` | Existing RSS endpoint |

### Auth routes

| Route | Purpose |
|-------|---------|
| `GET /login` | Email form |
| `POST /auth/magic-link` | Create a one-time login token and send email |
| `GET /auth/verify` | Verify token, create session, set HttpOnly cookie |
| `POST /logout` | Delete current session cookie and DB session |

### App routes

| Route | Purpose |
|-------|---------|
| `GET /app/subscriptions` | Logged-in subscription center |
| `POST /app/feishu-channels` | Add or replace a Feishu webhook after a test send |
| `POST /app/subscriptions` | Save selected source IDs for a channel |
| `POST /app/subscriptions/:id/pause` | Pause one subscription |
| `POST /app/subscriptions/:id/resume` | Resume one subscription |
| `POST /app/feishu-channels/:id/delete` | Delete a webhook and its subscriptions |

Keep existing JSON API routes unchanged. Do not turn `/sources`, `/sources/:id`, `/items`, or `/items/:id` into HTML routes in this release.

## Authentication

Use email magic links for MVP login.

Flow:

1. User enters email on `/login`.
2. Worker validates and normalizes the email address.
3. Worker creates a random token, stores only its hash in D1, and sends the plain token in a time-limited link.
4. User opens `/auth/verify?token=...`.
5. Worker checks token hash, expiry, and unused status.
6. Worker creates or updates the `users` row.
7. Worker creates a session, stores only the session token hash, and sets a `Secure`, `HttpOnly`, `SameSite=Lax` cookie.

Use Cloudflare Email Sending via a Worker `send_email` binding in production. Define an `EmailSender` interface and provide a console/dev sender for local development only, gated behind `APP_ENV=local`.

Security requirements:

- Magic links expire after 15 minutes.
- Magic links are single-use.
- Session cookies expire after 30 days.
- Session tokens and magic-link tokens are never stored in plaintext.
- Login POST returns the same response whether the email exists or not.
- Rate-limit login link creation per email and client IP.

## Feishu webhook handling

Users provide a Feishu custom bot webhook URL after login. Beacon must verify the webhook before storing it as active.

Flow:

1. User pastes Feishu webhook in `/app/subscriptions`.
2. Worker validates URL shape and host.
3. Worker sends a test Feishu message using the existing Feishu payload sender.
4. If Feishu returns success, Worker encrypts the webhook URL and stores it.
5. User can then select sources for that channel.

Storage requirements:

- Store webhook URLs encrypted with Web Crypto AES-GCM.
- Keep the encryption key in a Worker secret named `WEBHOOK_ENCRYPTION_KEY`.
- Never return the full webhook URL to the browser after saving.
- Display only a masked value, last test status, and last error.

MVP does not need Feishu webhook signing. If signed Feishu bots are added later, store an encrypted signing secret per channel and include signed payload support in the Feishu sender.

## Data model

Add D1 migrations for these tables.

### `users`

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PRIMARY KEY AUTOINCREMENT | Internal user id |
| `email` | TEXT NOT NULL UNIQUE | Normalized lowercase email |
| `created_at` | INTEGER NOT NULL | Epoch ms |
| `last_login_at` | INTEGER | Epoch ms |

### `auth_magic_links`

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PRIMARY KEY AUTOINCREMENT | Internal id |
| `email` | TEXT NOT NULL | Target email |
| `token_hash` | TEXT NOT NULL UNIQUE | SHA-256 or HMAC-SHA-256 hash |
| `expires_at` | INTEGER NOT NULL | Epoch ms |
| `used_at` | INTEGER | Epoch ms |
| `created_at` | INTEGER NOT NULL | Epoch ms |

### `sessions`

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PRIMARY KEY AUTOINCREMENT | Internal id |
| `user_id` | INTEGER NOT NULL REFERENCES users(id) | Owner |
| `token_hash` | TEXT NOT NULL UNIQUE | Hashed session token |
| `expires_at` | INTEGER NOT NULL | Epoch ms |
| `created_at` | INTEGER NOT NULL | Epoch ms |
| `last_seen_at` | INTEGER | Epoch ms |

### `feishu_channels`

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PRIMARY KEY AUTOINCREMENT | Channel id |
| `user_id` | INTEGER NOT NULL REFERENCES users(id) | Owner |
| `display_name` | TEXT NOT NULL | User-facing label |
| `webhook_ciphertext` | TEXT NOT NULL | Base64 AES-GCM payload |
| `webhook_fingerprint` | TEXT NOT NULL | Hash for duplicate detection |
| `status` | TEXT NOT NULL | `active`, `paused`, or `error` |
| `last_test_at` | INTEGER | Epoch ms |
| `last_error` | TEXT | Latest send/test error |
| `created_at` | INTEGER NOT NULL | Epoch ms |
| `updated_at` | INTEGER NOT NULL | Epoch ms |

### `subscriptions`

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PRIMARY KEY AUTOINCREMENT | Subscription id |
| `user_id` | INTEGER NOT NULL REFERENCES users(id) | Owner |
| `channel_id` | INTEGER NOT NULL REFERENCES feishu_channels(id) | Target channel |
| `source_id` | TEXT NOT NULL REFERENCES sources(id) | Source |
| `enabled` | INTEGER NOT NULL DEFAULT 1 | Boolean |
| `created_at` | INTEGER NOT NULL | Epoch ms |
| `updated_at` | INTEGER NOT NULL | Epoch ms |

Add a unique index on `(channel_id, source_id)`.

### `notification_deliveries`

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PRIMARY KEY AUTOINCREMENT | Delivery id |
| `channel_id` | INTEGER NOT NULL REFERENCES feishu_channels(id) | Target |
| `source_id` | TEXT NOT NULL | Source id |
| `event_kind` | TEXT NOT NULL | `append`, `append_batch`, `state_change`, `crawl_error` |
| `item_id` | INTEGER | Nullable for batch/error |
| `event_key` | TEXT NOT NULL | Stable dedupe key |
| `status` | TEXT NOT NULL | `sent`, `failed`, or `skipped` |
| `error` | TEXT | Latest error |
| `sent_at` | INTEGER | Epoch ms |
| `created_at` | INTEGER NOT NULL | Epoch ms |

Add a unique index on `(channel_id, event_key)` to prevent duplicate user-level delivery.

Event key rules:

- `append`: `append:{itemId}`
- `state_change`: `state:{itemId}:{updatedAtOrStateChangedAt}`
- `append_batch`: `append_batch:{sourceId}:{comma-separated item ids}`
- `crawl_error`: `crawl_error:{sourceId}:{runLogId or startedAt}`

## Notification dispatch

Keep the existing global dispatch behavior for environment-configured transports. Add a user-subscription dispatch path that runs after events are consolidated.

Recommended interface:

```ts
export async function dispatchUserSubscriptions(
  env: Env,
  db: Db,
  events: NotificationEvent[],
): Promise<void>;
```

Behavior:

1. Ignore empty event arrays.
2. For each event, find active Feishu channels with enabled subscriptions for `event.sourceId`.
3. Build the Feishu payload with the existing `buildFeishuNotificationPayload(event)` function.
4. Send to each decrypted channel webhook.
5. Record success or failure in `notification_deliveries`.
6. Do not mark `items.notified` based on user-subscription sends.

The current `items.notified` field remains tied to legacy global notification behavior. Multi-user delivery state belongs in `notification_deliveries`, not `items`.

For MVP, delivery can be synchronous like the current Feishu path, reusing the D1-backed rate limiter. If user count grows, move user delivery to a dedicated notify queue as described in the existing notify queue backlog spec.

## Public browsing UX

The public UI should be dense and utility-oriented:

- Source filter/search at the top or left.
- Main list of recent items with source name, title, summary, published time, and original link.
- Source chips or tabs for high-level categories: blogs/changelogs, model catalogs, infrastructure.
- Source detail pages show source metadata, last run status, and recent items.
- State-mode sources should show current state and recent changes rather than pretending to be articles.

No marketing landing page is needed for MVP. The first screen should be the usable recent-message browser.

## Subscription UX

The logged-in `/app/subscriptions` page should show:

- Current account email.
- Feishu webhook status card with masked webhook, last test time, and last error.
- Source checklist grouped by category.
- Save button for subscription changes.
- Test message button.
- Pause all / resume all controls.

When a user has no webhook yet, the source checklist can be visible but disabled until the webhook test succeeds.

## Error handling

| Failure | Behavior |
|---------|----------|
| Invalid email | Return generic login response; do not disclose validation details beyond malformed input |
| Email send failure | Log server-side; show generic retry message |
| Expired magic link | Show login page with "link expired" state |
| Reused magic link | Show login page with "link already used" state |
| Invalid session | Clear cookie and redirect to `/login` |
| Invalid Feishu webhook URL | Reject before sending test |
| Feishu test send failure | Do not store as active; show Feishu error summary |
| Subscription send failure | Record delivery failure and keep channel active until five consecutive failures |
| Repeated Feishu failures | Mark channel `error` after five consecutive failures and stop sending until user retests |

## Testing

Add focused tests around the new boundaries:

- Auth token creation, hashing, expiry, and single-use verification.
- Session cookie creation and session lookup.
- Feishu webhook validation, encryption/decryption, masking, and test-send flow.
- Subscription CRUD ownership checks.
- Source subscription filtering for notification events.
- User delivery dedupe via `notification_deliveries`.
- Public HTML handlers render sources and item lists from mocked repo calls.
- Existing API JSON behavior remains compatible.

Manual smoke test:

1. Start local Worker.
2. Open `/` and verify sources/items render without login.
3. Request login link with a test email using dev email sender.
4. Open magic link and verify session cookie is set.
5. Add a Feishu webhook and receive a test message.
6. Subscribe to one source.
7. Run that source with `forceNotify=1`.
8. Verify only subscribed channels receive the message.
9. Pause the subscription and verify no further messages are sent.

## Documentation

Update both README files when implementation lands:

- Public browsing routes.
- Login setup.
- Cloudflare Email Sending binding and sender domain setup.
- `WEBHOOK_ENCRYPTION_KEY` secret.
- Feishu webhook privacy and deletion behavior.
- Difference between global deployment notifications and per-user subscriptions.

## Rollout plan

1. Ship public browsing pages over existing read APIs.
2. Ship magic-link auth without subscriptions.
3. Ship Feishu channel setup and test-send.
4. Ship subscription selection and user-level dispatch.
5. Add delivery logs and failure thresholds.
6. Revisit notify queue if synchronous user dispatch creates crawl latency.

## Out of scope

- Feishu OAuth login.
- GitHub or social login.
- User-created sources.
- Paid plans or quotas.
- Team accounts.
- Per-user notification templates.
- Full SPA build pipeline.
- Background delivery queue for MVP.
