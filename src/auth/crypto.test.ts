import { describe, expect, it } from 'vitest';
import { generateToken, hashToken } from './crypto';

describe('auth crypto', () => {
	it('generates url-safe random tokens', () => {
		const token = generateToken();

		expect(token.length).toBeGreaterThanOrEqual(32);
		expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
	});

	it('hashes tokens deterministically without returning the token', async () => {
		const hash = await hashToken('secret-token');

		expect(hash).toBe(await hashToken('secret-token'));
		expect(hash).not.toContain('secret-token');
		expect(hash).toMatch(/^[a-f0-9]{64}$/);
	});
});
