import type { NotifyEvent } from '../sources/types';
import type { Db } from '../db/client';
import { markItemNotified } from '../db/repo';

export interface CrawlErrorEvent {
	sourceId: string;
	sourceName: string;
	error: string;
}

function isConfigured(env: Env): boolean {
	return Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID);
}

function formatAppendEvent(event: NotifyEvent): string {
	const lines = [
		`[beacon] 新条目 · ${event.sourceName}`,
		event.title,
	];
	if (event.summary) lines.push(event.summary);
	if (event.url) lines.push(event.url);
	return lines.join('\n');
}

function formatStateChangeEvent(event: NotifyEvent): string {
	const lines = [
		`[beacon] 状态变化 · ${event.sourceName}`,
		event.title,
	];
	if (event.diff) {
		lines.push(JSON.stringify(event.diff, null, 2));
	}
	if (event.url) lines.push(event.url);
	return lines.join('\n');
}

export function formatCrawlErrorEvent(event: CrawlErrorEvent): string {
	return [
		`[beacon] 抓取失败 · ${event.sourceName}`,
		`source: ${event.sourceId}`,
		event.error,
	].join('\n');
}

async function sendTelegramMessage(env: Env, text: string): Promise<void> {
	const response = await fetch(
		`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
		{
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				chat_id: env.TELEGRAM_CHAT_ID,
				text,
				disable_web_page_preview: true,
			}),
		},
	);
	if (!response.ok) {
		const body = await response.text();
		throw new Error(`Telegram send failed: ${response.status} ${body}`);
	}
}

export async function dispatchNotifyEvents(
	env: Env,
	db: Db,
	events: NotifyEvent[],
): Promise<void> {
	if (!isConfigured(env) || events.length === 0) {
		return;
	}

	for (const event of events) {
		const text =
			event.type === 'append'
				? formatAppendEvent(event)
				: formatStateChangeEvent(event);
		await sendTelegramMessage(env, text);
		if (event.type === 'append') {
			await markItemNotified(db, event.itemId);
		}
	}
}

export async function notifyCrawlError(
	env: Env,
	event: CrawlErrorEvent,
	options?: { previousStatus?: string | null },
): Promise<void> {
	if (!isConfigured(env)) {
		return;
	}
	if (options?.previousStatus === 'error') {
		return;
	}
	await sendTelegramMessage(env, formatCrawlErrorEvent(event));
}
