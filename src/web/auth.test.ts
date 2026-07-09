import { describe, expect, it, vi } from 'vitest';
import { createAuthRoutes } from './auth';

const ENV = {} as Env;

describe('auth web routes', () => {
	it('requests a magic link for a valid email and returns a generic response', async () => {
		const requestMagicLink = vi.fn().mockResolvedValue(undefined);
		const app = createAuthRoutes({ requestMagicLink });

		const response = await app.request(
			'/auth/magic-link',
			{
				method: 'POST',
				headers: { 'content-type': 'application/x-www-form-urlencoded' },
				body: new URLSearchParams({ email: 'USER@Example.COM ' }),
			},
			ENV,
		);

		expect(response.status).toBe(200);
		expect(await response.text()).toContain('Check your email');
		expect(requestMagicLink).toHaveBeenCalledWith(expect.anything(), 'user@example.com', 'http://localhost');
	});

	it('rejects malformed email input', async () => {
		const requestMagicLink = vi.fn();
		const app = createAuthRoutes({ requestMagicLink });

		const response = await app.request(
			'/auth/magic-link',
			{
				method: 'POST',
				headers: { 'content-type': 'application/x-www-form-urlencoded' },
				body: new URLSearchParams({ email: 'not-an-email' }),
			},
			ENV,
		);

		expect(response.status).toBe(400);
		expect(requestMagicLink).not.toHaveBeenCalled();
	});

	it('sets a session cookie when verification succeeds', async () => {
		const app = createAuthRoutes({
			verifyMagicLink: vi.fn().mockResolvedValue({
				ok: true,
				sessionToken: 'session-token',
				expiresAt: Date.parse('2026-08-01T00:00:00.000Z'),
			}),
		});

		const response = await app.request('/auth/verify?token=login-token', undefined, ENV);

		expect(response.status).toBe(302);
		expect(response.headers.get('location')).toBe('/app/subscriptions');
		expect(response.headers.get('set-cookie')).toContain('beacon_session=session-token');
	});

	it('shows an expired link response when verification fails', async () => {
		const app = createAuthRoutes({
			verifyMagicLink: vi.fn().mockResolvedValue({ ok: false, reason: 'expired' }),
		});

		const response = await app.request('/auth/verify?token=login-token', undefined, ENV);

		expect(response.status).toBe(400);
		expect(await response.text()).toContain('link expired');
	});

	it('clears the session cookie on logout', async () => {
		const logoutSession = vi.fn().mockResolvedValue(undefined);
		const app = createAuthRoutes({ logoutSession });

		const response = await app.request(
			'/logout',
			{
				method: 'POST',
				headers: { cookie: 'beacon_session=session-token' },
			},
			ENV,
		);

		expect(response.status).toBe(302);
		expect(response.headers.get('location')).toBe('/');
		expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
		expect(logoutSession).toHaveBeenCalledWith(expect.anything(), 'session-token');
	});
});
