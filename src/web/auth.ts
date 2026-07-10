import { Hono } from 'hono';
import { createDb, type Db } from '../db/client';
import { generateToken, hashToken } from '../auth/crypto';
import {
	deleteSessionByHash,
	getMagicLinkByHash,
	insertMagicLink,
	insertSession,
	markMagicLinkUsed,
	upsertUserByEmail,
} from '../auth/repo';
import { reserveAuthRateLimit, type RateLimitResult } from '../auth/rate-limit';
import {
	clearSessionCookie,
	createSessionCookie,
	parseCookieHeader,
	SESSION_COOKIE_NAME,
	SESSION_TTL_MS,
} from '../auth/session';
import { emailSender, type EmailSender } from '../email/sender';

const MAGIC_LINK_TTL_MS = 15 * 60 * 1000;

export type VerifyMagicLinkResult =
	| { ok: true; sessionToken: string; expiresAt: number }
	| { ok: false; reason: 'missing' | 'expired' | 'used' };

export interface AuthRouteDeps {
	requestMagicLink?: (env: Env, email: string, origin: string) => Promise<void>;
	verifyMagicLink?: (env: Env, token: string) => Promise<VerifyMagicLinkResult>;
	logoutSession?: (env: Env, sessionToken: string | undefined) => Promise<void>;
	reserveRateLimit?: (key: string, now: number, intervalMs: number) => Promise<RateLimitResult>;
}

function html(title: string, body: string): string {
	return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>
:root{color-scheme:light dark;font-family:Inter,ui-sans-serif,system-ui,sans-serif;line-height:1.5}
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#f7f7f4 0%,#e8f0f2 100%);color:#171717}
.card{width:100%;max-width:380px;margin:16px;background:#fff;border:1px solid #e3e3e3;border-radius:16px;box-shadow:0 8px 30px rgba(0,0,0,.06);padding:40px 32px;box-sizing:border-box}
.card h1{font-size:22px;margin:0 0 8px;color:#111}
.card p.subtitle{color:#666;font-size:14px;margin:0 0 24px}
label.field{display:block;font-size:13px;font-weight:600;color:#333;margin-bottom:6px}
input[type=email]{width:100%;padding:11px 14px;border:1px solid #ccc;border-radius:8px;font:inherit;box-sizing:border-box;background:#fafafa}
input[type=email]:focus{outline:none;border-color:#155e75;box-shadow:0 0 0 3px rgba(21,94,117,.12);background:#fff}
button{width:100%;margin-top:16px;padding:12px;border:none;border-radius:8px;background:#155e75;color:#fff;font:inherit;font-weight:600;cursor:pointer}
button:hover{background:#124c5f}
button:active{transform:translateY(1px)}
.message{text-align:center;padding:14px 16px;border-radius:8px;margin-bottom:20px;font-size:14px}
.message.info{background:#e8f4f8;color:#155e75;border:1px solid #c2dce4}
.message.error{background:#fde8e8;color:#a12020;border:1px solid #f3c2c2}
.back{display:block;text-align:center;margin-top:20px;font-size:14px;color:#155e75;text-decoration:none}
.back:hover{text-decoration:underline}
</style></head><body>${body}</body></html>`;
}

function normalizeEmail(value: unknown): string | null {
	if (typeof value !== 'string') {
		return null;
	}
	const email = value.trim().toLowerCase();
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
		return null;
	}
	return email;
}

async function parseForm(request: Request): Promise<Record<string, string>> {
	const contentType = request.headers.get('content-type') ?? '';
	if (contentType.includes('application/x-www-form-urlencoded')) {
		return Object.fromEntries(await request.formData()) as Record<string, string>;
	}
	if (contentType.includes('application/json')) {
		const body = await request.json().catch(() => ({}));
		return typeof body === 'object' && body ? (body as Record<string, string>) : {};
	}
	return {};
}

async function defaultRequestMagicLink(
	env: Env,
	email: string,
	origin: string,
	sender: EmailSender = emailSender,
	now = Date.now(),
): Promise<void> {
	const db = createDb(env);
	const token = generateToken();
	await insertMagicLink(db, {
		email,
		tokenHash: await hashToken(token),
		expiresAt: now + MAGIC_LINK_TTL_MS,
		createdAt: now,
	});
	const link = `${origin}/auth/verify?token=${encodeURIComponent(token)}`;
	await sender.send(env, {
		to: email,
		subject: 'Sign in to Beacon',
		text: `Open this link to sign in to Beacon. It expires in 15 minutes:\n\n${link}`,
		html: `<p>Open this link to sign in to Beacon. It expires in 15 minutes:</p><p><a href="${link}">${link}</a></p>`,
	});
}

async function createVerifiedSession(db: Db, email: string, now: number) {
	const user = await upsertUserByEmail(db, { email, now });
	const sessionToken = generateToken();
	const expiresAt = now + SESSION_TTL_MS;
	await insertSession(db, {
		userId: user.id,
		tokenHash: await hashToken(sessionToken),
		expiresAt,
		createdAt: now,
	});
	return { sessionToken, expiresAt };
}

async function defaultVerifyMagicLink(env: Env, token: string): Promise<VerifyMagicLinkResult> {
	if (!token) {
		return { ok: false, reason: 'missing' };
	}
	const db = createDb(env);
	const now = Date.now();
	const tokenHash = await hashToken(token);
	const link = await getMagicLinkByHash(db, tokenHash);
	if (!link) {
		return { ok: false, reason: 'missing' };
	}
	if (link.used_at !== null) {
		return { ok: false, reason: 'used' };
	}
	if (link.expires_at <= now) {
		return { ok: false, reason: 'expired' };
	}
	const marked = await markMagicLinkUsed(db, { tokenHash, usedAt: now });
	if (!marked) {
		return { ok: false, reason: 'used' };
	}
	return { ok: true, ...(await createVerifiedSession(db, link.email, now)) };
}

async function defaultLogoutSession(env: Env, sessionToken: string | undefined): Promise<void> {
	if (!sessionToken) {
		return;
	}
	await deleteSessionByHash(createDb(env), await hashToken(sessionToken));
}

export function createAuthRoutes(deps: AuthRouteDeps = {}): Hono<{ Bindings: Env }> {
	const app = new Hono<{ Bindings: Env }>();
	const requestMagicLink = deps.requestMagicLink ?? defaultRequestMagicLink;
	const verifyMagicLink = deps.verifyMagicLink ?? defaultVerifyMagicLink;
	const logoutSession = deps.logoutSession ?? defaultLogoutSession;

	app.get('/login', (c) =>
		c.html(
			html(
				'Beacon login',
				'<main class="card"><h1>Sign in to Beacon</h1><p class="subtitle">Enter your email and we\'ll send you a magic sign-in link.</p><form method="post" action="/auth/magic-link"><label class="field" for="email">Email address</label><input id="email" name="email" type="email" placeholder="you@example.com" required><button type="submit">Send magic link</button></form><a class="back" href="/">← Back to home</a></main>',
			),
		),
	);

	app.post('/auth/magic-link', async (c) => {
		const form = await parseForm(c.req.raw);
		const email = normalizeEmail(form.email);
		if (!email) {
			return c.html(html('Invalid email', '<main class="card"><div class="message error">Invalid email address.</div><a class="back" href="/login">← Back to sign in</a></main>'), 400);
		}
		const reserveRateLimit =
			deps.reserveRateLimit ?? ((key: string, now: number, intervalMs: number) =>
				reserveAuthRateLimit(createDb(c.env), key, now, intervalMs));
		const ip = c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? 'unknown';
		const now = Date.now();
		const ipResult = await reserveRateLimit(`ip:${ip}`, now, 60_000);
		if (!ipResult.allowed) {
			return c.html(
				html('Check your email', '<main class="card"><div class="message info">Check your email for a sign-in link.</div><a class="back" href="/login">← Back to sign in</a></main>'),
			);
		}
		const emailResult = await reserveRateLimit(`email:${email}`, now, 60_000);
		if (!emailResult.allowed) {
			await ipResult.rollback();
			return c.html(
				html('Check your email', '<main class="card"><div class="message info">Check your email for a sign-in link.</div><a class="back" href="/login">← Back to sign in</a></main>'),
			);
		}
		await requestMagicLink(c.env, email, new URL(c.req.url).origin);
		return c.html(
			html('Check your email', '<main class="card"><div class="message info">Check your email for a sign-in link.</div><a class="back" href="/login">← Back to sign in</a></main>'),
		);
	});

	app.get('/auth/verify', async (c) => {
		const token = c.req.query('token') ?? '';
		const result = await verifyMagicLink(c.env, token);
		if (!result.ok) {
			const label = result.reason === 'expired' ? 'link expired' : 'link invalid';
			return c.html(html('Login link failed', `<main class="card"><div class="message error">${label}</div><a class="back" href="/login">← Try signing in again</a></main>`), 400);
		}
		c.header('Set-Cookie', createSessionCookie(result.sessionToken, result.expiresAt));
		return c.redirect('/app/subscriptions');
	});

	app.post('/logout', async (c) => {
		const token = parseCookieHeader(c.req.header('cookie'))[SESSION_COOKIE_NAME];
		await logoutSession(c.env, token);
		c.header('Set-Cookie', clearSessionCookie());
		return c.redirect('/');
	});

	return app;
}
