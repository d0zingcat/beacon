# Web Subscriptions Follow-up — Design

**Date:** 2026-07-10
**Status:** Draft for review

## Goal

Close the production-readiness and UX gaps left after the initial public web and Feishu subscriptions MVP landed on `main`.

This follow-up does not redesign the product. It makes the shipped MVP match the original contract more closely:

- Production magic-link login has a configured Email binding.
- Magic-link creation is rate-limited by email and client IP.
- Logged-in users can pause and resume individual source subscriptions.
- The subscription page groups sources into scan-friendly sections.
- Documentation clearly separates shipped synchronous delivery from future notify-queue work.

## Current State

The merged MVP already includes:

- Public browse pages: `/`, `/browse/sources`, `/browse/sources/:id`, `/browse/items/:id`.
- Email magic-link auth code: `src/web/auth.ts`, `src/auth/*`, `src/email/sender.ts`.
- Feishu webhook validation, encryption, and storage.
- Subscription selection via `POST /app/subscriptions`.
- Per-user Feishu dispatch via `dispatchUserSubscriptions()`.
- Migration `migrations/0011_web_subscriptions.sql`.

The code is functional, but review found several gaps that should be fixed before treating the web subscription flow as production-ready.

## Scope

### In scope

1. **Email Sending configuration**
   - Add a production `send_email` binding named `EMAIL` to `wrangler.jsonc`.
   - Keep local development explicit with `APP_ENV=local`, allowing the existing console sender to print magic links.
   - Update README setup instructions for verified sender domains.

2. **Magic-link rate limiting**
   - Add a D1-backed `auth_rate_limit` table in a new `0012` migration.
   - Limit magic-link creation by normalized email and client IP.
   - Preserve generic success responses so attackers cannot distinguish valid users or rate-limited addresses.

3. **Subscription pause and resume**
   - Add subscription-level pause/resume routes:
     - `POST /app/subscriptions/:id/pause`
     - `POST /app/subscriptions/:id/resume`
   - Implement ownership checks through `user_id` in the update query.
   - Render pause/resume controls on `/app/subscriptions`.

4. **Grouped source selection**
   - Group source checkboxes by:
     - `Blogs and changelogs`
     - `Model catalogs`
     - `Infrastructure`
   - Keep the existing form shape: repeated `sourceId` fields and a single `channelId`.

5. **Documentation and backlog**
   - Keep README and README.zh-CN in sync.
   - Document that per-user Feishu delivery remains synchronous in this phase.
   - Extend the existing notify-queue backlog note so future queue work includes user-channel delivery, not only global notification delivery.

### Out of scope

- Feishu OAuth login.
- Multiple Feishu channels per user beyond the currently rendered first-channel UI.
- Team accounts.
- Paid plans or quotas.
- Full SPA migration.
- Async notify queue implementation.
- Changing existing JSON API paths.
- Reworking the crawler or source registry.

## Design Decisions

| Topic | Decision | Rationale |
|-------|----------|-----------|
| Email binding | Configure `send_email` as `EMAIL` in production only | The code already consumes `env.EMAIL`; local dev can use `APP_ENV=local` without a real sender |
| Rate-limit storage | New `auth_rate_limit` D1 table in `0012` | Avoid mutating the already-merged `0011` migration and keep limits durable across Worker isolates |
| Rate-limit keys | `email:{normalizedEmail}` and `ip:{clientIp}` | Covers repeated requests against one account and broad abuse from one client |
| Rate-limit response | Same "Check your email" response when limited | Avoids account enumeration and does not reveal whether an email exists |
| Pause/resume model | Toggle `subscriptions.enabled` | Existing dispatch already filters on `enabled = 1`, so no dispatch change is needed |
| Ownership checks | Update by both `id` and `user_id` | Prevents logged-in users from modifying another user's subscription ids |
| Source grouping | Deterministic labels based on source id/mode | Avoids introducing a category registry before the product needs one |
| Notify queue | Document only | Synchronous delivery is acceptable for this follow-up; queue migration is a separate scaling project |

## Data Model

Add a new migration:

```sql
CREATE TABLE IF NOT EXISTS auth_rate_limit (
  key TEXT PRIMARY KEY,
  next_available_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

No existing table needs to be changed for pause/resume. The current `subscriptions.enabled` boolean is the source of truth.

## Auth Flow Changes

`POST /auth/magic-link` should run this sequence:

1. Parse and normalize email.
2. Reject malformed email with `400`.
3. Build rate-limit keys:
   - `email:{email}`
   - `ip:{cf-connecting-ip || x-forwarded-for || unknown}`
4. Reserve both rate-limit slots for a 60-second interval.
5. If either reservation fails, return the same generic success page and do not send email.
6. If both reservations succeed, create and send the magic link as today.

This keeps the existing magic-link token lifecycle unchanged: 15-minute expiry, single-use token hash, and 30-day session cookie after successful verification.

## Subscription Flow Changes

`/app/subscriptions` should continue to save selected source ids through the existing `POST /app/subscriptions` route.

Add two focused routes:

- `POST /app/subscriptions/:id/pause`
- `POST /app/subscriptions/:id/resume`

Each route:

1. Requires the current session user.
2. Parses `:id` as a subscription id.
3. Updates only rows matching both `subscriptions.id` and `subscriptions.user_id`.
4. Redirects back to `/app/subscriptions`.

The UI should render each saved subscription with its source name and one action button:

- Enabled subscription: `Pause`.
- Disabled subscription: `Resume`.

## Subscription Page Grouping

Group the source checkbox list in three sections:

| Group | Rule |
|-------|------|
| `Model catalogs` | `source.id === 'bedrock-models'` |
| `Infrastructure` | `source.mode === 'state'` |
| `Blogs and changelogs` | All other sources |

This follows the categories already used in README and avoids adding a new schema field.

## Error Handling

| Failure | Behavior |
|---------|----------|
| Email binding missing in production | `src/email/sender.ts` throws `EMAIL binding is not configured`; README should prevent this setup mistake |
| Local Email binding missing with `APP_ENV=local` | Console sender logs the magic link email body |
| Rate-limited magic-link request | Return generic success page; do not create token or send email |
| Invalid subscription id | Redirect to `/app/subscriptions` after a no-op update |
| Subscription id owned by another user | No-op update because query includes `user_id`; redirect normally |
| Disabled subscription receives event | No send because dispatch already queries `s.enabled = 1` |

## Testing

Add or update tests for:

- `reserveAuthRateLimit()` first request, blocked repeated request, and allowed post-window request.
- `POST /auth/magic-link` rate-limited path returns generic success and does not call magic-link sender.
- `POST /app/subscriptions/:id/pause` calls the subscription toggle with `enabled=false`.
- `POST /app/subscriptions/:id/resume` calls the subscription toggle with `enabled=true`.
- `/app/subscriptions` renders grouped source headings.

Final verification:

```bash
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/vitest run
```

## Rollout

1. Ship Email binding config and docs first.
2. Ship magic-link rate limiting in a new migration.
3. Ship pause/resume routes and controls.
4. Ship grouped source selection.
5. Update README and notify-queue backlog notes.

This order lets production auth setup be fixed before adding new subscription behavior.
