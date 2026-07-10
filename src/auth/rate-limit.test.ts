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
