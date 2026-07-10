import { describe, expect, it } from 'vitest';
import { clearSessionCookie, createSessionCookie, parseCookieHeader } from './session';

describe('session cookies', () => {
	it('creates a secure httponly session cookie', () => {
		const cookie = createSessionCookie('session-token', Date.parse('2026-08-01T00:00:00.000Z'));

		expect(cookie).toContain('beacon_session=session-token');
		expect(cookie).toContain('HttpOnly');
		expect(cookie).toContain('Secure');
		expect(cookie).toContain('SameSite=Lax');
		expect(cookie).toContain('Path=/');
		expect(cookie).toContain('Expires=Sat, 01 Aug 2026 00:00:00 GMT');
	});

	it('creates a clearing cookie for logout', () => {
		const cookie = clearSessionCookie();

		expect(cookie).toContain('beacon_session=');
		expect(cookie).toContain('Max-Age=0');
		expect(cookie).toContain('HttpOnly');
	});

	it('parses cookie headers', () => {
		expect(parseCookieHeader('foo=bar; beacon_session=abc123; theme=dark')).toEqual({
			foo: 'bar',
			beacon_session: 'abc123',
			theme: 'dark',
		});
	});
});
