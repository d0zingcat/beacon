# Public Web and Feishu Subscriptions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the MVP public browse UI, magic-link login, Feishu channel setup, source subscriptions, and per-user Feishu dispatch.

**Architecture:** Keep one Cloudflare Worker/Hono deployment. Existing JSON APIs remain unchanged; HTML browsing uses `/browse/...`. Authentication and subscriptions live in D1 tables, Feishu webhooks are encrypted with a Worker secret, and user-level delivery runs beside the current global notification dispatch.

**Tech Stack:** Cloudflare Workers, Hono, D1, TypeScript, Vitest, Web Crypto, Cloudflare Email Sending binding.

## Global Constraints

- Documentation and commit messages must be English.
- Existing JSON API routes `/sources`, `/sources/:id`, `/items`, and `/items/:id` must remain JSON-compatible.
- Public browsing requires no login.
- Subscription and Feishu channel management require login.
- Magic links expire after 15 minutes and are single-use.
- Session cookies expire after 30 days and use `Secure`, `HttpOnly`, `SameSite=Lax`.
- Webhook URLs are encrypted in D1 with `WEBHOOK_ENCRYPTION_KEY`.
- User subscription sends must not drive the legacy `items.notified` flag.

---

## File Structure

- Create `migrations/0011_web_subscriptions.sql`: auth, channel, subscription, delivery tables.
- Modify `src/bindings.d.ts`: add `APP_ENV`, `WEBHOOK_ENCRYPTION_KEY`, and optional `EMAIL`.
- Create `src/auth/crypto.ts`: token generation, hashing, URL-safe encoding.
- Create `src/auth/repo.ts`: user, magic-link, and session D1 queries.
- Create `src/auth/session.ts`: cookie parsing/setting and current-user lookup.
- Create `src/email/sender.ts`: production Email binding sender and local console sender.
- Create `src/subscriptions/crypto.ts`: webhook encryption, decryption, fingerprinting, masking.
- Create `src/subscriptions/repo.ts`: Feishu channel, subscription, and delivery D1 queries.
- Create `src/subscriptions/dispatch.ts`: user-level Feishu delivery by source subscription.
- Create `src/web/render.ts`: HTML layout helpers and escaping.
- Create `src/web/public.ts`: public browse handlers.
- Create `src/web/auth.ts`: login, magic-link request, verify, logout handlers.
- Create `src/web/app.ts`: logged-in subscription handlers.
- Modify `src/notify/feishu.ts`: export direct webhook send helper.
- Modify `src/crawler/runner.ts`: call user-subscription dispatch after global dispatch.
- Modify `src/router.ts`: mount public, auth, and app routes without breaking JSON APIs.
- Add focused tests next to the new modules.

## Tasks

### Task 1: Schema and Auth Foundation

**Files:**
- Create: `migrations/0011_web_subscriptions.sql`
- Create: `src/auth/crypto.ts`
- Create: `src/auth/repo.ts`
- Create: `src/auth/session.ts`
- Create: `src/auth/crypto.test.ts`
- Create: `src/auth/session.test.ts`
- Modify: `src/bindings.d.ts`

**Interfaces:**
- Produces: `generateToken(bytes?: number): string`
- Produces: `hashToken(token: string): Promise<string>`
- Produces: `createSessionCookie(token: string, expiresAt: number): string`
- Produces: `clearSessionCookie(): string`

- [ ] Write failing tests for token hashing and session cookies.
- [ ] Run `pnpm test src/auth/crypto.test.ts src/auth/session.test.ts` and confirm expected failures.
- [ ] Add auth crypto/session implementation and D1 schema.
- [ ] Run the same tests and confirm pass.

### Task 2: Feishu Channel Storage

**Files:**
- Create: `src/subscriptions/crypto.ts`
- Create: `src/subscriptions/repo.ts`
- Create: `src/subscriptions/crypto.test.ts`

**Interfaces:**
- Produces: `encryptSecret(plaintext: string, key: string): Promise<string>`
- Produces: `decryptSecret(ciphertext: string, key: string): Promise<string>`
- Produces: `fingerprintSecret(value: string): Promise<string>`
- Produces: `maskWebhookUrl(url: string): string`

- [ ] Write failing tests for encryption round-trip, fingerprint stability, and webhook masking.
- [ ] Run `pnpm test src/subscriptions/crypto.test.ts` and confirm expected failures.
- [ ] Add subscription crypto and repository functions.
- [ ] Run the same tests and confirm pass.

### Task 3: Email Magic Link Flow

**Files:**
- Create: `src/email/sender.ts`
- Create: `src/web/auth.ts`
- Create: `src/web/auth.test.ts`
- Modify: `src/router.ts`

**Interfaces:**
- Produces: `createAuthRoutes(): Hono<{ Bindings: Env }>`
- Uses: auth repo, `EmailSender`, session cookie helpers.

- [ ] Write failing route tests for login request, verify success, expired token, and logout.
- [ ] Run `pnpm test src/web/auth.test.ts` and confirm expected failures.
- [ ] Implement email sender abstraction and auth routes.
- [ ] Run the same tests and confirm pass.

### Task 4: Public Browse UI

**Files:**
- Create: `src/web/render.ts`
- Create: `src/web/public.ts`
- Create: `src/web/public.test.ts`
- Modify: `src/router.ts`

**Interfaces:**
- Produces: `createPublicWebRoutes(): Hono<{ Bindings: Env }>`
- Keeps existing JSON `/sources` and `/items` behavior unchanged.

- [ ] Write failing tests for `/`, `/browse/sources`, and `/browse/sources/:id`.
- [ ] Run `pnpm test src/web/public.test.ts` and confirm expected failures.
- [ ] Implement HTML render helpers and public browse handlers.
- [ ] Run the same tests and confirm pass.

### Task 5: Subscription App Routes

**Files:**
- Create: `src/web/app.ts`
- Create: `src/web/app.test.ts`
- Modify: `src/router.ts`
- Modify: `src/notify/feishu.ts`

**Interfaces:**
- Produces: `createAppRoutes(): Hono<{ Bindings: Env }>`
- Produces from Feishu: `sendFeishuWebhook(webhookUrl: string, body: string): Promise<void>`

- [ ] Write failing tests for login guard, Feishu test-store flow, and subscription save.
- [ ] Run `pnpm test src/web/app.test.ts` and confirm expected failures.
- [ ] Implement app routes and direct Feishu webhook send helper.
- [ ] Run the same tests and confirm pass.

### Task 6: User Subscription Dispatch

**Files:**
- Create: `src/subscriptions/dispatch.ts`
- Create: `src/subscriptions/dispatch.test.ts`
- Modify: `src/crawler/runner.ts`

**Interfaces:**
- Produces: `dispatchUserSubscriptions(env: Env, db: Db, events: NotificationEvent[]): Promise<void>`

- [ ] Write failing tests for source filtering, delivery dedupe, successful send recording, and failure recording.
- [ ] Run `pnpm test src/subscriptions/dispatch.test.ts` and confirm expected failures.
- [ ] Implement user-level dispatch and call it from `runSource()` after global dispatch.
- [ ] Run the same tests and confirm pass.

### Task 7: Docs and Full Verification

**Files:**
- Modify: `README.md`
- Modify: `README.zh-CN.md`

- [ ] Update both READMEs with public web, login, Email Sending, and Feishu subscription setup.
- [ ] Run `pnpm test`.
- [ ] Run `pnpm run typecheck`.
- [ ] Commit the implementation.
