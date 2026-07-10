import type { Db } from '../db/client';

const MAX_ACQUIRE_ATTEMPTS = 20;

export async function reserveAuthRateLimit(
	db: Db,
	key: string,
	now: number,
	intervalMs: number,
): Promise<boolean> {
	for (let attempt = 0; attempt < MAX_ACQUIRE_ATTEMPTS; attempt++) {
		const row = await db.first<{ next_available_at: number }>(
			`SELECT next_available_at FROM auth_rate_limit WHERE key = ? LIMIT 1`,
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
				return true;
			}
			continue;
		}
		if (row.next_available_at > now) {
			return false;
		}
		const updated = await db.run(
			`UPDATE auth_rate_limit SET next_available_at = ?, updated_at = ? WHERE key = ? AND next_available_at = ?`,
			now + intervalMs,
			now,
			key,
			row.next_available_at,
		);
		if ((updated.meta.changes ?? 0) > 0) {
			return true;
		}
	}

	throw new Error(`Failed to reserve auth rate limit slot for ${key}`);
}
