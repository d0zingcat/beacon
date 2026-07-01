import type { Db } from '../db/client';
import { markItemNotified } from '../db/repo';
import { formatNotification } from './format';
import { createTransports } from './transport';
import type { NotificationEvent } from './types';

export async function dispatchNotifications(
	env: Env,
	db: Db,
	events: NotificationEvent[],
): Promise<void> {
	const transports = createTransports(env);
	if (transports.length === 0 || events.length === 0) {
		return;
	}

	for (const event of events) {
		if (event.kind === 'crawl_error' && event.suppress) {
			continue;
		}

		const text = formatNotification(event);
		const results = await Promise.allSettled(
			transports.map((transport) => transport.send(env, text)),
		);

		for (const result of results) {
			if (result.status === 'rejected') {
				console.error('Notification send failed:', result.reason);
			}
		}

		const anyOk = results.some((result) => result.status === 'fulfilled');
		if (anyOk && event.kind === 'append') {
			await markItemNotified(db, event.itemId);
		}
	}
}
