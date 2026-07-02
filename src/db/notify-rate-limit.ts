import { sleep } from '../notify/rate-limiter';

const MAX_ACQUIRE_ATTEMPTS = 20;

export async function reserveNotifySlot(
	db: D1Database,
	channel: string,
	minIntervalMs: number,
): Promise<void> {
	for (let attempt = 0; attempt < MAX_ACQUIRE_ATTEMPTS; attempt++) {
		const now = Date.now();
		const row = await db
			.prepare('SELECT next_available_at FROM notify_rate_limit WHERE channel = ?')
			.bind(channel)
			.first<{ next_available_at: number }>();

		const currentNext = row?.next_available_at ?? 0;
		const sendAt = Math.max(now, currentNext);
		const newNext = sendAt + minIntervalMs;

		if (!row) {
			const inserted = await db
				.prepare(
					'INSERT INTO notify_rate_limit (channel, next_available_at) VALUES (?, ?) ON CONFLICT(channel) DO NOTHING',
				)
				.bind(channel, newNext)
				.run();
			if (inserted.meta.changes > 0) {
				if (sendAt > now) {
					await sleep(sendAt - now);
				}
				return;
			}
			continue;
		}

		const updated = await db
			.prepare(
				'UPDATE notify_rate_limit SET next_available_at = ? WHERE channel = ? AND next_available_at = ?',
			)
			.bind(newNext, channel, currentNext)
			.run();

		if (updated.meta.changes > 0) {
			if (sendAt > now) {
				await sleep(sendAt - now);
			}
			return;
		}
	}

	throw new Error(`Failed to acquire notify rate limit slot for ${channel}`);
}
