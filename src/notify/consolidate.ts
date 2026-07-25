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

/** Prefer the latest append event when the same itemId appears more than once in a run. */
export function dedupeAppendEventsByItemId(events: AppendEvent[]): AppendEvent[] {
	const byItemId = new Map<number, AppendEvent>();
	for (const event of events) {
		byItemId.set(event.itemId, event);
	}
	return [...byItemId.values()];
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

	const uniqueAppendEvents = dedupeAppendEventsByItemId(appendEvents);
	const deduped = uniqueAppendEvents.length !== appendEvents.length;

	if (uniqueAppendEvents.length <= 1) {
		if (!deduped) {
			return events;
		}
		return [...uniqueAppendEvents, ...otherEvents];
	}

	const batch: NotificationEvent = {
		kind: 'append_batch',
		sourceId: uniqueAppendEvents[0].sourceId,
		sourceName: uniqueAppendEvents[0].sourceName,
		sourceKind: uniqueAppendEvents[0].sourceKind,
		maxItems: batchMaxItems,
		items: uniqueAppendEvents.map(toBatchItem),
	};

	return [batch, ...otherEvents];
}
