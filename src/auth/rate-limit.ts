import type { Db } from '../db/client';

const MAX_ACQUIRE_ATTEMPTS = 20;

export interface RateLimitResult {
	allowed: boolean;
	/** Undo the reservation. No-op when {@link allowed} is false. */
	rollback: () => Promise<void>;
}

export async function reserveAuthRateLimit(
	db: Db,
	key: string,
	now: number,
	intervalMs: number,
): Promise<RateLimitResult> {
	const noop = async (): Promise<void> => {};
	for (let attempt = 0; attempt < MAX_ACQUIRE_ATTEMPTS; attempt++) {
		const row = await db.first<{ next_available_at: number; updated_at: number }>(
			`SELECT next_available_at, updated_at FROM auth_rate_limit WHERE key = ? LIMIT 1`,
			key,
		);
		if (!row) {
			const inserted = await db.run(
				`INSERT INTO auth_rate_limit (key, next_available_at, updated_at)
				 VALUES (?, ?, ?) ON CONFLICT(key) DO NOTHING`,
				key,
				now + intervalMs,
				now,
			);
			if ((inserted.meta.changes ?? 0) > 0) {
				return {
					allowed: true,
					rollback: async () => {
						await db.run(`DELETE FROM auth_rate_limit WHERE key = ?`, key);
					},
				};
			}
			continue;
		}
		if (row.next_available_at > now) {
			return { allowed: false, rollback: noop };
		}
		const updated = await db.run(
			`UPDATE auth_rate_limit SET next_available_at = ?, updated_at = ? WHERE key = ? AND next_available_at = ?`,
			now + intervalMs,
			now,
			key,
			row.next_available_at,
		);
		if ((updated.meta.changes ?? 0) > 0) {
			const previousNext = row.next_available_at;
			const previousUpdated = row.updated_at;
			return {
				allowed: true,
				rollback: async () => {
					await db.run(
						`UPDATE auth_rate_limit SET next_available_at = ?, updated_at = ? WHERE key = ?`,
						previousNext,
						previousUpdated,
						key,
					);
				},
			};
		}
	}

	throw new Error(`Failed to reserve auth rate limit slot for ${key}`);
}
