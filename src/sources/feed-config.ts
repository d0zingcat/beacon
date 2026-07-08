import { DEFAULT_BATCH_NOTIFY_MAX_ITEMS } from '../config';

export const DEFAULT_FEED_HEADERS: Record<string, string> = {
	'user-agent': 'beacon/1.0 (+https://github.com/d0zingcat/beacon)',
	accept: 'application/rss+xml, application/xml, text/xml',
};

export interface FeedSourceConfig {
	feedUrl: string;
	headers?: Record<string, string>;
	format?: 'rss2';
	/** Max items listed in a merged batch notification; falls back to DEFAULT_BATCH_NOTIFY_MAX_ITEMS */
	batchNotifyMaxItems?: number;
}

export interface FeedSourceInput {
	id: string;
	name: string;
	mode: 'append';
	config: FeedSourceConfig;
}

export function parseFeedSourceConfig(raw: string | null | undefined): FeedSourceConfig | null {
	if (!raw) {
		return null;
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return null;
	}
	return validateFeedSourceConfig(parsed);
}

export function validateFeedSourceConfig(value: unknown): FeedSourceConfig | null {
	if (!value || typeof value !== 'object') {
		return null;
	}
	const record = value as Record<string, unknown>;
	if (typeof record.feedUrl !== 'string' || !isHttpsUrl(record.feedUrl)) {
		return null;
	}
	if (record.headers !== undefined) {
		if (!isStringRecord(record.headers)) {
			return null;
		}
	}
	if (record.format !== undefined && record.format !== 'rss2') {
		return null;
	}
	if (record.batchNotifyMaxItems !== undefined) {
		if (
			typeof record.batchNotifyMaxItems !== 'number' ||
			!Number.isInteger(record.batchNotifyMaxItems) ||
			record.batchNotifyMaxItems < 1
		) {
			return null;
		}
	}
	return {
		feedUrl: record.feedUrl,
		headers: record.headers as Record<string, string> | undefined,
		format: record.format as 'rss2' | undefined,
		batchNotifyMaxItems:
			(record.batchNotifyMaxItems as number | undefined) ?? DEFAULT_BATCH_NOTIFY_MAX_ITEMS,
	};
}

export function serializeFeedSourceConfig(config: FeedSourceConfig): string {
	return JSON.stringify(config);
}

export function validateFeedSourceInput(value: unknown): FeedSourceInput | null {
	if (!value || typeof value !== 'object') {
		return null;
	}
	const record = value as Record<string, unknown>;
	if (typeof record.id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(record.id)) {
		return null;
	}
	if (typeof record.name !== 'string' || record.name.trim().length === 0) {
		return null;
	}
	if (record.mode !== 'append') {
		return null;
	}
	const config = validateFeedSourceConfig(record.config);
	if (!config) {
		return null;
	}
	return {
		id: record.id,
		name: record.name.trim(),
		mode: 'append',
		config,
	};
}

function isHttpsUrl(value: string): boolean {
	try {
		const url = new URL(value);
		return url.protocol === 'https:';
	} catch {
		return false;
	}
}

function isStringRecord(value: unknown): value is Record<string, string> {
	if (!value || typeof value !== 'object') {
		return false;
	}
	return Object.values(value).every((entry) => typeof entry === 'string');
}
