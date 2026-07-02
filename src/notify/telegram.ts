import { formatNotification } from './format';
import type { NotifierTransport } from './transport';
import type { NotificationEvent } from './types';

function isConfigured(env: Env): boolean {
	return Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID);
}

async function send(env: Env, event: NotificationEvent): Promise<void> {
	const text = formatNotification(event);
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

export const telegramTransport: NotifierTransport = {
	id: 'telegram',
	isConfigured,
	send,
};
