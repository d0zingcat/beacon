import { DEFAULT_BATCH_NOTIFY_MAX_ITEMS } from '../config';
import type { AppendNotificationItem, NotificationEvent } from './types';

type AppendEvent = Extract<NotificationEvent, { kind: 'append' }>;

function toBatchItem(event: AppendEvent): AppendNotificationItem {
	return {
		itemId: event.itemId,
		title: event.title,
		url: event.url,
		publishedAt: event.publishedAt,
	};
}

export function consolidateAppendNotifications(
	events: NotificationEvent[],
	batchMaxItems: number = DEFAULT_BATCH_NOTIFY_MAX_ITEMS,
): NotificationEvent[] {
	const appendEvents: AppendEvent[] = [];
	const otherEvents: NotificationEvent[] = [];

	for (const event of events) {
		if (event.kind === 'append') {
			appendEvents.push(event);
		} else {
			otherEvents.push(event);
		}
	}

	if (appendEvents.length <= 1) {
		return events;
	}

	const batch: NotificationEvent = {
		kind: 'append_batch',
		sourceId: appendEvents[0].sourceId,
		sourceName: appendEvents[0].sourceName,
		maxItems: batchMaxItems,
		items: appendEvents.map(toBatchItem),
	};

	return [batch, ...otherEvents];
}
