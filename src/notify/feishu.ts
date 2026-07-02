import { formatDmitStateDiff } from './format-dmit';
import { formatPublishedAt } from './format-time';
import type { NotifierTransport } from './transport';
import type { NotificationEvent } from './types';

const DMIT_STOCK_SOURCE_ID = 'dmit-stock';

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

async function send(env: Env, event: NotificationEvent): Promise<void> {
	const response = await fetch(env.FEISHU_WEBHOOK_URL, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: buildFeishuNotificationPayload(event),
	});
	if (!response.ok) {
		const body = await response.text();
		throw new Error(`Feishu send failed: ${response.status} ${body}`);
	}
	const result = (await response.json()) as { code?: number; msg?: string };
	if (result.code !== undefined && result.code !== 0) {
		throw new Error(`Feishu send failed: ${result.code} ${result.msg ?? ''}`);
	}
}

export const feishuTransport: NotifierTransport = {
	id: 'feishu',
	isConfigured,
	send,
};
