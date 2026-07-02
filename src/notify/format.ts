import { formatDmitStateChangeEvent } from './format-dmit';
import type { NotificationEvent } from './types';

const DMIT_STOCK_SOURCE_ID = 'dmit-stock';

function formatAppendEvent(event: Extract<NotificationEvent, { kind: 'append' }>): string {
	const lines = [`[beacon] 新条目 · ${event.sourceName}`, event.title];
	if (event.summary) lines.push(event.summary);
	if (event.url) lines.push(event.url);
	return lines.join('\n');
}

function formatStateChangeEvent(
	event: Extract<NotificationEvent, { kind: 'state_change' }>,
): string {
	if (event.sourceId === DMIT_STOCK_SOURCE_ID) {
		return formatDmitStateChangeEvent(event);
	}

	const lines = [`[beacon] 状态变化 · ${event.sourceName}`, event.title];
	if (event.diff) {
		lines.push(JSON.stringify(event.diff, null, 2));
	}
	if (event.url) lines.push(event.url);
	return lines.join('\n');
}

function formatCrawlErrorEvent(
	event: Extract<NotificationEvent, { kind: 'crawl_error' }>,
): string {
	return [
		`[beacon] 抓取失败 · ${event.sourceName}`,
		`source: ${event.sourceId}`,
		event.error,
	].join('\n');
}

export function formatNotification(event: NotificationEvent): string {
	switch (event.kind) {
		case 'append':
			return formatAppendEvent(event);
		case 'state_change':
			return formatStateChangeEvent(event);
		case 'crawl_error':
			return formatCrawlErrorEvent(event);
	}
}
