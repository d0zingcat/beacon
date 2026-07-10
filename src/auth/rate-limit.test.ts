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

// Mock for the retry test: SELECT always returns no row, and the INSERT reports
// a lost ON CONFLICT race (`changes: 0`) for the first `failCount` attempts before
// finally succeeding. Proves the function retries instead of giving up.
function retryingMockDb(failCount: number) {
	const rows = new Map<string, { next_available_at: number; updated_at: number }>();
	let insertAttempts = 0;
	return {
		async first() {
			return null;
		},
		async run(sql: string, ...params: unknown[]) {
			if (sql.includes('INSERT')) {
				insertAttempts++;
				if (insertAttempts <= failCount) {
					return { meta: { changes: 0 } };
				}
				const [key, nextAvailableAt, updatedAt] = params as [string, number, number];
				rows.set(key, { next_available_at: nextAvailableAt, updated_at: updatedAt });
				return { meta: { changes: 1 } };
			}
			return { meta: { changes: 0 } };
		},
	} as Db;
}

// Mock for the concurrent first-request race: implements real ON CONFLICT semantics.
// The first INSERT for a key wins (`changes: 1`); a second concurrent INSERT reports
// the conflict (`changes: 0`). The loser retries, then reads the now-existing row.
function racingMockDb() {
	const rows = new Map<string, { next_available_at: number; updated_at: number }>();
	return {
		async first(_sql: string, key: string) {
			return (rows.get(key) ?? null) as { next_available_at: number } | null;
		},
		async run(sql: string, ...params: unknown[]) {
			if (sql.includes('INSERT')) {
				const [key, nextAvailableAt, updatedAt] = params as [string, number, number];
				if (rows.has(key)) return { meta: { changes: 0 } };
				rows.set(key, { next_available_at: nextAvailableAt, updated_at: updatedAt });
				return { meta: { changes: 1 } };
			}
			if (sql.includes('UPDATE')) {
				const [nextAvailableAt, updatedAt, key, expected] = params as [number, number, string, number];
				const current = rows.get(key);
				if (current && current.next_available_at === expected) {
					rows.set(key, { next_available_at: nextAvailableAt, updated_at: updatedAt });
					return { meta: { changes: 1 } };
				}
				return { meta: { changes: 0 } };
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

	it('retries when the INSERT loses an ON CONFLICT race and eventually succeeds', async () => {
		const db = retryingMockDb(3);
		await expect(reserveAuthRateLimit(db, 'email:user@example.com', 1000, 60_000)).resolves.toBe(true);
	});

	it('resolves a concurrent first-request race with one allowed, one blocked, and no errors', async () => {
		const db = racingMockDb();
		const results = await Promise.all([
			reserveAuthRateLimit(db, 'email:victim@example.com', 1000, 60_000),
			reserveAuthRateLimit(db, 'email:victim@example.com', 1000, 60_000),
		]);
		const trues = results.filter((r) => r === true).length;
		const falses = results.filter((r) => r === false).length;
		expect(trues).toBe(1);
		expect(falses).toBe(1);
	});
});
