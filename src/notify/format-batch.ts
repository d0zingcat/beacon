import { MAX_NOTIFICATION_TEXT_LENGTH } from '../config';
import { formatTitleWithPublishedAt } from './format-time';
import { truncateNotificationText } from './truncate';
import type { NotificationEvent } from './types';

type AppendBatchEvent = Extract<NotificationEvent, { kind: 'append_batch' }>;

function formatBatchItemLine(index: number, item: AppendBatchEvent['items'][number]): string {
	const lines = [`${index}. ${formatTitleWithPublishedAt(item.title, item.publishedAt)}`];
	if (item.url) {
		lines.push(`🔗 ${item.url}`);
	}
	return lines.join('\n');
}

function buildAppendBatchText(event: AppendBatchEvent, shownCount: number): string {
	const total = event.items.length;
	const shown = event.items.slice(0, shownCount);
	const lines = [`📰 新条目 · ${event.sourceName}（${total} 条）`, ''];

	for (const [index, item] of shown.entries()) {
		lines.push(formatBatchItemLine(index + 1, item));
	}

	const omitted = total - shown.length;
	if (omitted > 0) {
		lines.push('', `… 另有 ${omitted} 条未列出`);
	}

	return lines.join('\n');
}

export function formatAppendBatchEvent(event: AppendBatchEvent): string {
	const cap = Math.max(1, Math.min(event.maxItems, event.items.length));
	let shownCount = cap;

	while (shownCount > 1) {
		const text = buildAppendBatchText(event, shownCount);
		if (text.length <= MAX_NOTIFICATION_TEXT_LENGTH) {
			return text;
		}
		shownCount -= 1;
	}

	return truncateNotificationText(buildAppendBatchText(event, shownCount));
}
