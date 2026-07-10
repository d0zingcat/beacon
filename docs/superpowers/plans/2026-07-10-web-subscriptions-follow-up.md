# Web Subscriptions Follow-up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining gaps in Beacon's public web and Feishu subscription MVP after the initial merge.

**Architecture:** Keep the existing Worker-hosted Hono web app. Add the missing production Email binding configuration, D1-backed magic-link rate limiting, subscription pause/resume controls, and clearer subscription management UI without changing the existing JSON API routes. Keep notification delivery synchronous for now, but document a separate notify-queue follow-up when user volume grows.

**Tech Stack:** Cloudflare Workers, Hono, D1, TypeScript, Vitest, Wrangler JSONC, Cloudflare Email Sending binding.

**Design:** `docs/superpowers/specs/2026-07-10-web-subscriptions-follow-up-design.md`

## Global Constraints

- Documentation and commit messages must be English.
- Existing JSON API routes `/sources`, `/sources/:id`, `/items`, and `/items/:id` must remain JSON-compatible.
- Public browsing requires no login.
- Subscription and Feishu channel management require login.
- Magic links expire after 15 minutes and are single-use.
- Session cookies expire after 30 days and use `Secure`, `HttpOnly`, `SameSite=Lax`.
- Webhook URLs are encrypted in D1 with `WEBHOOK_ENCRYPTION_KEY`.
- User subscription sends must not drive the legacy `items.notified` flag.
- Keep README.md and README.zh-CN.md in sync for user-facing docs.

---

## Current State

The initial web subscription MVP is present on `main`:

- Public pages: `/`, `/browse/sources`, `/browse/sources/:id`, `/browse/items/:id`.
- Email magic-link auth code: `src/web/auth.ts`, `src/auth/*`, `src/email/sender.ts`.
- Feishu channel storage: `src/subscriptions/crypto.ts`, `src/subscriptions/repo.ts`.
- Subscription center: `src/web/app.ts`.
- User subscription dispatch: `src/subscriptions/dispatch.ts`, wired from `src/crawler/runner.ts`.
- Schema migration: `migrations/0011_web_subscriptions.sql`.

Remaining gaps found during review:

- `send_email` / `EMAIL` binding is referenced in code and docs but not configured in `wrangler.jsonc` or `wrangler.local.jsonc`.
- `POST /auth/magic-link` has no per-email or per-IP rate limit.
- `POST /app/subscriptions/:id/pause` and `POST /app/subscriptions/:id/resume` from the design spec are not implemented.
- The subscription UI does not expose pause/resume controls or grouped source sections.
- Notification delivery remains synchronous; acceptable for MVP, but should become a separate notify queue when user volume grows.

## File Structure

- Modify `wrangler.jsonc`: add Cloudflare Email Sending binding named `EMAIL`.
- Modify `wrangler.local.jsonc`: document local behavior via `APP_ENV=local`; do not require local Email binding.
- Modify `src/bindings.d.ts`: keep the `EMAIL` type aligned with the Worker binding.
- Create `migrations/0012_auth_rate_limit.sql`: add the `auth_rate_limit` table without mutating the already-merged `0011` migration.
- Create `src/auth/rate-limit.ts`: D1-backed rate limiter for magic-link requests.
- Create `src/auth/rate-limit.test.ts`: focused tests for rate limiting.
- Modify `src/web/auth.ts`: check rate limit before creating a magic link.
- Modify `src/web/auth.test.ts`: route tests for rate-limit behavior.
- Modify `src/subscriptions/repo.ts`: add pause/resume helpers.
- Modify `src/web/app.ts`: add pause/resume routes and UI controls.
- Modify `src/web/app.test.ts`: tests for pause/resume routes and rendered controls.
- Modify `README.md` and `README.zh-CN.md`: document Email binding, local login behavior, pause/resume subscription management, and follow-up queue guidance.

## Tasks

### Task 1: Configure Email Binding

**Files:**
- Modify: `wrangler.jsonc`
- Modify: `wrangler.local.jsonc`
- Modify: `README.md`
- Modify: `README.zh-CN.md`

**Interfaces:**
- Consumes: existing `env.EMAIL` usage in `src/email/sender.ts`.
- Produces: production Worker binding named `EMAIL`.

- [ ] **Step 1: Update production Wrangler config**

Add the Email Sending binding to `wrangler.jsonc`:

```jsonc
"send_email": [
  {
    "name": "EMAIL"
  }
],
```

Place it at the top level next to `d1_databases` and `queues`.

- [ ] **Step 2: Keep local config explicit**

Add a local vars block to `wrangler.local.jsonc` if it does not exist:

```jsonc
"vars": {
  "APP_ENV": "local"
}
```

Do not add a local `send_email` binding. Local magic-link requests should use the existing console sender when `APP_ENV=local`.

- [ ] **Step 3: Update English docs**

In `README.md`, add an Email Sending setup note under manual deploy:

```bash
pnpm exec wrangler email sending enable <your-domain>
```

Then state that production login requires the `EMAIL` binding and a verified sender domain.

- [ ] **Step 4: Update Chinese docs**

Mirror the same setup note in `README.zh-CN.md`, using the same command and explaining that production magic-link login requires `EMAIL` binding and verified sender domain.

- [ ] **Step 5: Run validation**

Run:

```bash
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/vitest run src/web/auth.test.ts
```

Expected: typecheck exits 0; auth route tests pass.

- [ ] **Step 6: Commit**

```bash
git add wrangler.jsonc wrangler.local.jsonc README.md README.zh-CN.md
git commit -m "Configure email binding for web login"
```

### Task 2: Add Magic-Link Rate Limiting

**Files:**
- Create: `migrations/0012_auth_rate_limit.sql`
- Create: `src/auth/rate-limit.ts`
- Create: `src/auth/rate-limit.test.ts`
- Modify: `src/web/auth.ts`
- Modify: `src/web/auth.test.ts`

**Interfaces:**
- Produces: `reserveAuthRateLimit(db: Db, key: string, now: number, intervalMs: number): Promise<boolean>`
- Consumes: `createDb(env)` from `src/db/client.ts`.

- [ ] **Step 1: Write migration**

Create `migrations/0012_auth_rate_limit.sql`:

```sql
CREATE TABLE IF NOT EXISTS auth_rate_limit (
  key TEXT PRIMARY KEY,
  next_available_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

Use a new migration instead of editing `0011` so already-applied databases can migrate forward safely.

- [ ] **Step 2: Write failing unit tests**

Create `src/auth/rate-limit.test.ts` with these tests:

```ts
import { describe, expect, it } from 'vitest';
import { reserveAuthRateLimit } from './rate-limit';
import type { Db } from '../db/client';

function mockDb() {
  const rows = new Map<string, { next_available_at: number; updated_at: number }>();
  return {
    async first<T>(_sql: string, key: string) {
      return (rows.get(key) ?? null) as T | null;
    },
    async run(sql: string, ...params: unknown[]) {
      if (sql.includes('INSERT')) {
        const [key, nextAvailableAt, updatedAt] = params as [string, number, number];
        if (rows.has(key)) return { meta: { changes: 0 } };
        rows.set(key, { next_available_at: nextAvailableAt, updated_at: updatedAt });
        return { meta: { changes: 1 } };
      }
      if (sql.includes('UPDATE')) {
        const [nextAvailableAt, updatedAt, key] = params as [number, number, string];
        rows.set(key, { next_available_at: nextAvailableAt, updated_at: updatedAt });
        return { meta: { changes: 1 } };
      }
      return { meta: { changes: 0 } };
    },
  } as Db;
}

describe('reserveAuthRateLimit', () => {
  it('allows the first request for a key', async () => {
    await expect(reserveAuthRateLimit(mockDb(), 'email:user@example.com', 1000, 60_000)).resolves.toBe(true);
  });

  it('blocks a repeated request before the interval expires', async () => {
    const db = mockDb();
    expect(await reserveAuthRateLimit(db, 'email:user@example.com', 1000, 60_000)).toBe(true);
    expect(await reserveAuthRateLimit(db, 'email:user@example.com', 2000, 60_000)).toBe(false);
  });

  it('allows another request after the interval expires', async () => {
    const db = mockDb();
    expect(await reserveAuthRateLimit(db, 'email:user@example.com', 1000, 60_000)).toBe(true);
    expect(await reserveAuthRateLimit(db, 'email:user@example.com', 61_000, 60_000)).toBe(true);
  });
});
```

- [ ] **Step 3: Run red test**

Run:

```bash
./node_modules/.bin/vitest run src/auth/rate-limit.test.ts
```

Expected: FAIL because `src/auth/rate-limit.ts` does not exist.

- [ ] **Step 4: Implement rate limiter**

Create `src/auth/rate-limit.ts`:

```ts
import type { Db } from '../db/client';

export async function reserveAuthRateLimit(
  db: Db,
  key: string,
  now: number,
  intervalMs: number,
): Promise<boolean> {
  const row = await db.first<{ next_available_at: number }>(
    `SELECT next_available_at FROM auth_rate_limit WHERE key = ? LIMIT 1`,
    key,
  );
  if (!row) {
    const result = await db.run(
      `INSERT INTO auth_rate_limit (key, next_available_at, updated_at)
       VALUES (?, ?, ?)`,
      key,
      now + intervalMs,
      now,
    );
    return (result.meta.changes ?? 0) > 0;
  }
  if (row.next_available_at > now) {
    return false;
  }
  await db.run(
    `UPDATE auth_rate_limit SET next_available_at = ?, updated_at = ? WHERE key = ?`,
    now + intervalMs,
    now,
    key,
  );
  return true;
}
```

- [ ] **Step 5: Wire limiter into auth route**

In `src/web/auth.ts`, before `requestMagicLink(...)`, call:

```ts
const db = createDb(c.env);
const ip = c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? 'unknown';
const now = Date.now();
const emailAllowed = await reserveAuthRateLimit(db, `email:${email}`, now, 60_000);
const ipAllowed = await reserveAuthRateLimit(db, `ip:${ip}`, now, 60_000);
if (!emailAllowed || !ipAllowed) {
  return c.html(
    html('Check your email', '<main><p>Check your email for a sign-in link.</p></main>'),
  );
}
```

Keep the response generic so attackers cannot distinguish rate-limited users from successfully emailed users.

- [ ] **Step 6: Add route test**

In `src/web/auth.test.ts`, add a test with an injected `reserveRateLimit` dependency if you introduce that seam, or mock a D1-backed limiter through the existing route dependency. Assert that a rate-limited request returns `200` with "Check your email" and does not call `requestMagicLink`.

- [ ] **Step 7: Run tests**

Run:

```bash
./node_modules/.bin/vitest run src/auth/rate-limit.test.ts src/web/auth.test.ts
./node_modules/.bin/tsc --noEmit
```

Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add migrations/0012_auth_rate_limit.sql src/auth/rate-limit.ts src/auth/rate-limit.test.ts src/web/auth.ts src/web/auth.test.ts
git commit -m "Add magic link rate limiting"
```

### Task 3: Add Subscription Pause and Resume

**Files:**
- Modify: `src/subscriptions/repo.ts`
- Modify: `src/web/app.ts`
- Modify: `src/web/app.test.ts`

**Interfaces:**
- Produces: `setSubscriptionEnabled(db: Db, input: { userId: number; subscriptionId: number; enabled: boolean; now: number }): Promise<boolean>`

- [ ] **Step 1: Write failing route tests**

In `src/web/app.test.ts`, add tests:

```ts
it('pauses a subscription owned by the current user', async () => {
  const setSubscriptionEnabled = vi.fn().mockResolvedValue(true);
  const app = createAppRoutes({
    getCurrentUser: vi.fn().mockResolvedValue(USER),
    setSubscriptionEnabled,
  });

  const response = await app.request('/app/subscriptions/99/pause', { method: 'POST' }, ENV);

  expect(response.status).toBe(302);
  expect(response.headers.get('location')).toBe('/app/subscriptions');
  expect(setSubscriptionEnabled).toHaveBeenCalledWith(expect.anything(), USER, 99, false);
});

it('resumes a subscription owned by the current user', async () => {
  const setSubscriptionEnabled = vi.fn().mockResolvedValue(true);
  const app = createAppRoutes({
    getCurrentUser: vi.fn().mockResolvedValue(USER),
    setSubscriptionEnabled,
  });

  const response = await app.request('/app/subscriptions/99/resume', { method: 'POST' }, ENV);

  expect(response.status).toBe(302);
  expect(response.headers.get('location')).toBe('/app/subscriptions');
  expect(setSubscriptionEnabled).toHaveBeenCalledWith(expect.anything(), USER, 99, true);
});
```

Extend `AppRouteDeps` with:

```ts
setSubscriptionEnabled?: (
  env: Env,
  user: CurrentUser,
  subscriptionId: number,
  enabled: boolean,
) => Promise<boolean>;
```

- [ ] **Step 2: Run red test**

Run:

```bash
./node_modules/.bin/vitest run src/web/app.test.ts
```

Expected: FAIL because `createAppRoutes` does not accept or use `setSubscriptionEnabled`, and pause/resume routes do not exist.

- [ ] **Step 3: Add repository helper**

In `src/subscriptions/repo.ts`, add:

```ts
export async function setSubscriptionEnabled(
  db: Db,
  input: { userId: number; subscriptionId: number; enabled: boolean; now: number },
): Promise<boolean> {
  const result = await db.run(
    `UPDATE subscriptions
     SET enabled = ?, updated_at = ?
     WHERE id = ? AND user_id = ?`,
    input.enabled ? 1 : 0,
    input.now,
    input.subscriptionId,
    input.userId,
  );
  return (result.meta.changes ?? 0) > 0;
}
```

- [ ] **Step 4: Add app route dependency and default**

In `src/web/app.ts`, import repository helper as `setSubscriptionEnabledInDb` and add:

```ts
const setSubscriptionEnabled =
  deps.setSubscriptionEnabled ??
  ((env, user, subscriptionId, enabled) =>
    setSubscriptionEnabledInDb(createDb(env), {
      userId: user.id,
      subscriptionId,
      enabled,
      now: Date.now(),
    }));
```

- [ ] **Step 5: Add pause route**

In `src/web/app.ts`, add:

```ts
app.post('/app/subscriptions/:id/pause', async (c) => {
  const user = c.get('user') as CurrentUser;
  await setSubscriptionEnabled(c.env, user, Number(c.req.param('id')), false);
  return c.redirect('/app/subscriptions');
});
```

- [ ] **Step 6: Add resume route**

In `src/web/app.ts`, add:

```ts
app.post('/app/subscriptions/:id/resume', async (c) => {
  const user = c.get('user') as CurrentUser;
  await setSubscriptionEnabled(c.env, user, Number(c.req.param('id')), true);
  return c.redirect('/app/subscriptions');
});
```

- [ ] **Step 7: Render controls**

In `renderSubscriptionPage`, below the source checklist or channel status, render existing subscriptions with pause/resume forms:

```ts
const subscriptionControls = input.subscriptions.map((subscription) => {
  const source = input.sources.find((item) => item.id === subscription.source_id);
  const action = subscription.enabled ? 'pause' : 'resume';
  const label = subscription.enabled ? 'Pause' : 'Resume';
  return `<form method="post" action="/app/subscriptions/${subscription.id}/${action}">
    <span>${escapeHtml(source?.name ?? subscription.source_id)}</span>
    <button type="submit">${label}</button>
  </form>`;
}).join('');
```

Place it in a `<section class="panel"><h2>Active subscriptions</h2>...</section>`.

- [ ] **Step 8: Run tests**

Run:

```bash
./node_modules/.bin/vitest run src/web/app.test.ts
./node_modules/.bin/tsc --noEmit
```

Expected: all pass.

- [ ] **Step 9: Commit**

```bash
git add src/subscriptions/repo.ts src/web/app.ts src/web/app.test.ts
git commit -m "Add subscription pause and resume"
```

### Task 4: Group Source Selection in Subscription UI

**Files:**
- Modify: `src/web/app.ts`
- Modify: `src/web/app.test.ts`

**Interfaces:**
- Consumes: existing `Source` values from `src/sources/types.ts`.
- Produces: `groupSourcesForSubscriptions(sources: Source[]): Array<{ label: string; sources: Source[] }>` if extracting helper is useful.

- [ ] **Step 1: Write failing render test**

In `src/web/app.test.ts`, add a render test with append, model catalog, and state sources. Assert the response contains:

```ts
expect(body).toContain('Blogs and changelogs');
expect(body).toContain('Model catalogs');
expect(body).toContain('Infrastructure');
```

Use source ids:

- `cursor-blog`
- `bedrock-models`
- `dmit-stock`

- [ ] **Step 2: Run red test**

Run:

```bash
./node_modules/.bin/vitest run src/web/app.test.ts
```

Expected: FAIL because grouping headings are not rendered.

- [ ] **Step 3: Add grouping helper**

In `src/web/app.ts`, add:

```ts
function sourceGroupLabel(source: Source): string {
  if (source.id === 'bedrock-models') return 'Model catalogs';
  if (source.mode === 'state') return 'Infrastructure';
  return 'Blogs and changelogs';
}
```

Then group sources in `renderSubscriptionPage`:

```ts
const groups = new Map<string, Source[]>();
for (const source of input.sources) {
  const label = sourceGroupLabel(source);
  groups.set(label, [...(groups.get(label) ?? []), source]);
}
```

- [ ] **Step 4: Render grouped checklists**

Replace the flat source checklist with:

```ts
const sourceList = [...groups.entries()].map(([label, sources]) =>
  `<fieldset class="panel"><legend>${escapeHtml(label)}</legend>${sources.map(renderSourceCheckbox).join('')}</fieldset>`
).join('');
```

Keep the existing checkbox names and values: `name="sourceId"` and `value="${source.id}"`.

- [ ] **Step 5: Run tests**

Run:

```bash
./node_modules/.bin/vitest run src/web/app.test.ts
./node_modules/.bin/tsc --noEmit
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/web/app.ts src/web/app.test.ts
git commit -m "Group subscription sources"
```

### Task 5: Update Documentation and Backlog Notes

**Files:**
- Modify: `README.md`
- Modify: `README.zh-CN.md`
- Modify: `docs/superpowers/specs/2026-07-02-notify-queue-rate-limit-design.md`

**Interfaces:**
- Consumes: shipped synchronous subscription dispatch in `src/subscriptions/dispatch.ts`.
- Produces: docs that distinguish shipped MVP behavior from future notify queue work.

- [ ] **Step 1: Update English README**

In `README.md`, extend the Web UI and subscriptions section with:

```md
Users can pause and resume individual source subscriptions from `/app/subscriptions`.
```

Add an operational note:

```md
Per-user Feishu delivery is synchronous in the MVP. If subscription volume grows, move delivery to a dedicated notify queue before treating it as high-throughput infrastructure.
```

- [ ] **Step 2: Update Chinese README**

Mirror those two notes in `README.zh-CN.md`.

- [ ] **Step 3: Update notify queue backlog**

In `docs/superpowers/specs/2026-07-02-notify-queue-rate-limit-design.md`, add a short section:

```md
## User subscription delivery

The web subscription MVP sends per-user Feishu notifications synchronously from `dispatchUserSubscriptions()`. A future queue implementation should include user-channel payloads, delivery IDs, and channel failure state updates, not only the legacy global `items.notified` flow.
```

- [ ] **Step 4: Run docs-adjacent validation**

Run:

```bash
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/vitest run src/web/app.test.ts src/web/auth.test.ts src/subscriptions/dispatch.test.ts
```

Expected: typecheck exits 0; focused tests pass.

- [ ] **Step 5: Commit**

```bash
git add README.md README.zh-CN.md docs/superpowers/specs/2026-07-02-notify-queue-rate-limit-design.md
git commit -m "Document web subscription follow-ups"
```

### Task 6: Full Verification

**Files:**
- No code changes.

**Interfaces:**
- Consumes: all previous task outputs.
- Produces: final verification evidence.

- [ ] **Step 1: Run typecheck**

Run:

```bash
./node_modules/.bin/tsc --noEmit
```

Expected: exits 0.

- [ ] **Step 2: Run full test suite**

Run:

```bash
./node_modules/.bin/vitest run
```

Expected: all tests pass.

- [ ] **Step 3: Check git state**

Run:

```bash
git status --short --branch
git log --oneline -5
```

Expected: feature branch is ahead of `origin/main` by the task commits, with no unstaged changes.

- [ ] **Step 4: Prepare PR summary**

Use this PR summary:

```md
## Summary

- Configure production Email binding and local login behavior for magic-link auth
- Add D1-backed magic-link rate limiting
- Add pause/resume controls for Feishu source subscriptions
- Group subscription source selection by category
- Update docs and notify-queue backlog notes for per-user delivery

## Verification

- ./node_modules/.bin/tsc --noEmit
- ./node_modules/.bin/vitest run
```

## Self-Review Notes

- This plan intentionally keeps notify queue work out of scope. The current synchronous delivery is acceptable for the next small follow-up and is documented as a scaling backlog.
- This plan uses `0012_auth_rate_limit.sql` instead of mutating `0011_web_subscriptions.sql` because the merged code may already have been deployed.
- The plan preserves existing JSON API paths and only changes logged-in web app behavior.
