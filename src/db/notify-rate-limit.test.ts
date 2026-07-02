import { describe, expect, it, vi } from 'vitest';
import { reserveNotifySlot } from './notify-rate-limit';

function mockD1Database(state: { nextAvailableAt?: number }) {
	const data = new Map<string, number>();
	if (state.nextAvailableAt !== undefined) {
		data.set('feishu', state.nextAvailableAt);
	}

	return {
		prepare(sql: string) {
			const normalized = sql.replace(/\s+/g, ' ').trim();
			return {
				bind(...params: unknown[]) {
					return {
						async first<T>() {
							if (normalized.startsWith('SELECT next_available_at')) {
								const channel = params[0] as string;
								const value = data.get(channel);
								if (value === undefined) {
									return null;
								}
								return { next_available_at: value } as T;
							}
							return null;
						},
						async run() {
							if (normalized.startsWith('INSERT INTO notify_rate_limit')) {
								const channel = params[0] as string;
								const nextAvailableAt = params[1] as number;
								if (data.has(channel)) {
									return { meta: { changes: 0 } };
								}
								data.set(channel, nextAvailableAt);
								return { meta: { changes: 1 } };
							}
							if (normalized.startsWith('UPDATE notify_rate_limit')) {
								const newNext = params[0] as number;
								const channel = params[1] as string;
								const expectedCurrent = params[2] as number;
								const current = data.get(channel);
								if (current !== expectedCurrent) {
									return { meta: { changes: 0 } };
								}
								data.set(channel, newNext);
								return { meta: { changes: 1 } };
							}
							return { meta: { changes: 0 } };
						},
					};
				},
			};
		},
	} as D1Database;
}

describe('reserveNotifySlot', () => {
	it('reserves the first slot without waiting', async () => {
		const db = mockD1Database({});
		const before = Date.now();
		await reserveNotifySlot(db, 'feishu', 600);
		expect(Date.now() - before).toBeLessThan(50);
	});

	it('waits until the next slot is available', async () => {
		const db = mockD1Database({ nextAvailableAt: Date.now() + 30 });
		const before = Date.now();
		await reserveNotifySlot(db, 'feishu', 600);
		expect(Date.now() - before).toBeGreaterThanOrEqual(25);
	});

	it('retries when another worker wins the race', async () => {
		let updateAttempts = 0;
		const data = new Map<string, number>([['feishu', 100]]);
		const db = {
			prepare(sql: string) {
				return {
					bind(...params: unknown[]) {
						return {
							async first<T>() {
								if (sql.includes('SELECT next_available_at')) {
									const channel = params[0] as string;
									const value = data.get(channel);
									if (value === undefined) {
										return null;
									}
									return { next_available_at: value } as T;
								}
								return null;
							},
							async run() {
								if (sql.includes('UPDATE notify_rate_limit')) {
									updateAttempts += 1;
									if (updateAttempts === 1) {
										return { meta: { changes: 0 } };
									}
									const newNext = params[0] as number;
									const channel = params[1] as string;
									data.set(channel, newNext);
									return { meta: { changes: 1 } };
								}
								return { meta: { changes: 0 } };
							},
						};
					},
				};
			},
		} as D1Database;

		await reserveNotifySlot(db, 'feishu', 600);
		expect(updateAttempts).toBeGreaterThanOrEqual(2);
	});
});
