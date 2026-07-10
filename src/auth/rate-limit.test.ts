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
			if (sql.includes('DELETE')) {
				const [key] = params as [string];
				return { meta: { changes: rows.delete(key) ? 1 : 0 } };
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
				if (sql.includes('AND next_available_at')) {
					// Optimistic-locked UPDATE from the main reservation path.
					const [nextAvailableAt, updatedAt, key, expected] = params as [number, number, string, number];
					const current = rows.get(key);
					if (current && current.next_available_at === expected) {
						rows.set(key, { next_available_at: nextAvailableAt, updated_at: updatedAt });
						return { meta: { changes: 1 } };
					}
					return { meta: { changes: 0 } };
				}
				// Unconditional UPDATE used by the rollback path.
				const [nextAvailableAt, updatedAt, key] = params as [number, number, string];
				if (rows.has(key)) {
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
		await expect(
			reserveAuthRateLimit(mockDb(), 'email:user@example.com', 1000, 60_000).then((r) => r.allowed),
		).resolves.toBe(true);
	});

	it('blocks a repeated request before the interval expires', async () => {
		const db = mockDb();
		expect(await reserveAuthRateLimit(db, 'email:user@example.com', 1000, 60_000).then((r) => r.allowed)).toBe(true);
		expect(await reserveAuthRateLimit(db, 'email:user@example.com', 2000, 60_000).then((r) => r.allowed)).toBe(false);
	});

	it('allows another request after the interval expires', async () => {
		const db = mockDb();
		expect(await reserveAuthRateLimit(db, 'email:user@example.com', 1000, 60_000).then((r) => r.allowed)).toBe(true);
		expect(await reserveAuthRateLimit(db, 'email:user@example.com', 61_000, 60_000).then((r) => r.allowed)).toBe(true);
	});

	it('retries when the INSERT loses an ON CONFLICT race and eventually succeeds', async () => {
		const db = retryingMockDb(3);
		await expect(
			reserveAuthRateLimit(db, 'email:user@example.com', 1000, 60_000).then((r) => r.allowed),
		).resolves.toBe(true);
	});

	it('resolves a concurrent first-request race with one allowed, one blocked, and no errors', async () => {
		const db = racingMockDb();
		const results = await Promise.all([
			reserveAuthRateLimit(db, 'email:victim@example.com', 1000, 60_000),
			reserveAuthRateLimit(db, 'email:victim@example.com', 1000, 60_000),
		]);
		const trues = results.filter((r) => r.allowed).length;
		const falses = results.filter((r) => !r.allowed).length;
		expect(trues).toBe(1);
		expect(falses).toBe(1);
	});

	it('rollback of a freshly-inserted row removes it so the next request is allowed', async () => {
		const db = mockDb();
		const first = await reserveAuthRateLimit(db, 'ip:203.0.113.5', 1000, 60_000);
		expect(first.allowed).toBe(true);
		const blocked = await reserveAuthRateLimit(db, 'ip:203.0.113.5', 2000, 60_000);
		expect(blocked.allowed).toBe(false);
		await first.rollback();
		const retried = await reserveAuthRateLimit(db, 'ip:203.0.113.5', 2000, 60_000);
		expect(retried.allowed).toBe(true);
	});

	it('rollback of an updated row restores the previous next_available_at', async () => {
		const db = racingMockDb();
		// First reservation at t=1000 sets next_available_at to 61_000.
		await reserveAuthRateLimit(db, 'ip:203.0.113.5', 1000, 60_000);
		// Second reservation at t=61_000 (slot now free) advances it to 121_000.
		const second = await reserveAuthRateLimit(db, 'ip:203.0.113.5', 61_000, 60_000);
		expect(second.allowed).toBe(true);
		// Rolling back restores the prior slot (t=61_000), so a request at t=61_000 is allowed again.
		await second.rollback();
		const retried = await reserveAuthRateLimit(db, 'ip:203.0.113.5', 61_000, 60_000);
		expect(retried.allowed).toBe(true);
	});
});
