import type { Db } from '../db/client';

export async function reserveAuthRateLimit(
	db: Db,
	key: string,
	now: number,
	intervalMs: number,
): Promise<boolean> {
	const row = await db.first<{ next_available_at: number }>(
		`SELECT next_available_at FROM auth_rate_limit WHERE key = ? LIMIT 1`,
		key,
	);
	if (!row) {
		const result = await db.run(
			`INSERT INTO auth_rate_limit (key, next_available_at, updated_at)
       VALUES (?, ?, ?)`,
			key,
			now + intervalMs,
			now,
		);
		return (result.meta.changes ?? 0) > 0;
	}
	if (row.next_available_at > now) {
		return false;
	}
	await db.run(
		`UPDATE auth_rate_limit SET next_available_at = ?, updated_at = ? WHERE key = ?`,
		now + intervalMs,
		now,
		key,
	);
	return true;
}
