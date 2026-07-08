import { reserveNotifySlot } from '../db/notify-rate-limit';
import { formatDmitStateDiff } from './format-dmit';
import { formatNotification } from './format';
import { formatPublishedAt } from './format-time';
import type { NotifierTransport } from './transport';
import { createSerialRateLimiter, sleep } from './rate-limiter';
import type { NotificationEvent } from './types';

/** Feishu custom bot: 100/min and 5/sec per tenant per bot. */
const FEISHU_MIN_INTERVAL_MS = 600;
const FEISHU_MAX_RETRIES = 3;
const FEISHU_RETRY_BASE_MS = 1_000;
const DMIT_STOCK_SOURCE_ID = 'dmit-stock';

const feishuSendLimiter = createSerialRateLimiter();

type FeishuPostElement =
	| { tag: 'text'; text: string }
	| { tag: 'a'; text: string; href: string };

type FeishuPostRow = FeishuPostElement[];

function isConfigured(env: Env): boolean {
	return Boolean(env.FEISHU_WEBHOOK_URL);
}

export function buildFeishuTextPayload(text: string): string {
	return JSON.stringify({
		msg_type: 'text',
		content: { text },
	});
}

function buildFeishuPostPayload(postTitle: string, content: FeishuPostRow[]): string {
	return JSON.stringify({
		msg_type: 'post',
		content: {
			post: {
				zh_cn: {
					title: postTitle,
					content,
				},
			},
		},
	});
}

function titleRow(title: string, url?: string, publishedAt?: number): FeishuPostRow {
	const row: FeishuPostRow = url
		? [{ tag: 'a', text: title, href: url }]
		: [{ tag: 'text', text: title }];
	if (publishedAt !== undefined) {
		row.push({ tag: 'text', text: ` · ${formatPublishedAt(publishedAt)}` });
	}
	return row;
}

function textRow(text: string): FeishuPostRow {
	return [{ tag: 'text', text }];
}

function buildAppendBatchPost(
	event: Extract<NotificationEvent, { kind: 'append_batch' }>,
): FeishuPostRow[] {
	const text = formatNotification(event);
	return text.split('\n').map((line) => textRow(line));
}

function buildAppendPost(
	event: Extract<NotificationEvent, { kind: 'append' }>,
): FeishuPostRow[] {
	const content: FeishuPostRow[] = [titleRow(event.title, event.url, event.publishedAt)];
	if (event.summary) {
		content.push(textRow(event.summary));
	}
	return content;
}

function buildStateChangePost(
	event: Extract<NotificationEvent, { kind: 'state_change' }>,
): FeishuPostRow[] {
	const content: FeishuPostRow[] = [titleRow(event.title, event.url, event.publishedAt)];

	if (event.sourceId === DMIT_STOCK_SOURCE_ID && event.diff) {
		const diffLines = formatDmitStateDiff(event.diff, event.summary);
		if (diffLines.length > 0) {
			content.push(...diffLines.map(textRow));
		} else if (event.summary) {
			content.push(textRow(event.summary));
		}
	} else if (event.diff) {
		content.push(textRow(JSON.stringify(event.diff, null, 2)));
	}

	return content;
}

export function buildFeishuNotificationPayload(event: NotificationEvent): string {
	switch (event.kind) {
		case 'append':
			return buildFeishuPostPayload(
				`📰 新条目 · ${event.sourceName}`,
				buildAppendPost(event),
			);
		case 'append_batch':
			return buildFeishuPostPayload(
				`📰 新条目 · ${event.sourceName}（${event.items.length} 条）`,
				buildAppendBatchPost(event),
			);
		case 'state_change':
			return buildFeishuPostPayload(
				`🔔 状态变化 · ${event.sourceName}`,
				buildStateChangePost(event),
			);
		case 'crawl_error':
			return buildFeishuTextPayload(
				[
					`⚠️ 抓取失败 · ${event.sourceName}`,
					`📌 source: ${event.sourceId}`,
					`❌ ${event.error}`,
				].join('\n'),
			);
	}
}

export function isFeishuRateLimitError(code: number | undefined, msg?: string): boolean {
	return code === 11232 || (msg?.includes('frequency limited') ?? false);
}

function isRateLimitFailure(error: unknown): boolean {
	if (!(error instanceof Error)) {
		return false;
	}
	return error.message.includes('11232') || error.message.includes('frequency limited');
}

async function sendOnce(env: Env, body: string): Promise<void> {
	const response = await fetch(env.FEISHU_WEBHOOK_URL, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body,
	});
	if (!response.ok) {
		const responseBody = await response.text();
		throw new Error(`Feishu send failed: ${response.status} ${responseBody}`);
	}
	const result = (await response.json()) as { code?: number; msg?: string };
	if (result.code !== undefined && result.code !== 0) {
		throw new Error(`Feishu send failed: ${result.code} ${result.msg ?? ''}`);
	}
}

async function sendWithRetry(env: Env, body: string): Promise<void> {
	for (let attempt = 0; attempt <= FEISHU_MAX_RETRIES; attempt++) {
		try {
			await sendOnce(env, body);
			return;
		} catch (error) {
			if (!isRateLimitFailure(error) || attempt === FEISHU_MAX_RETRIES) {
				throw error;
			}
			const delayMs = FEISHU_RETRY_BASE_MS * 2 ** attempt;
			await sleep(delayMs);
		}
	}
}

async function send(env: Env, event: NotificationEvent): Promise<void> {
	return feishuSendLimiter.schedule(async () => {
		await reserveNotifySlot(env.DB, 'feishu', FEISHU_MIN_INTERVAL_MS);
		await sendWithRetry(env, buildFeishuNotificationPayload(event));
	});
}

export const feishuTransport: NotifierTransport = {
	id: 'feishu',
	isConfigured,
	send,
};
