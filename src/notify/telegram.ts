import { formatNotification } from './format';
import type { NotifierTransport } from './transport';
import type { NotificationEvent } from './types';

function isConfigured(env: Env): boolean {
	return Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID);
}

function parseChatAndThread(env: Env): { chatId: string; messageThreadId?: number } {
	let chatId = (env.TELEGRAM_CHAT_ID ?? '').trim();
	let threadId = env.TELEGRAM_MESSAGE_THREAD_ID ? Number(env.TELEGRAM_MESSAGE_THREAD_ID.trim()) : undefined;
	if (chatId.includes(':') || chatId.includes('#')) {
		const delimiter = chatId.includes(':') ? ':' : '#';
		const [rawChat, rawThread] = chatId.split(delimiter);
		chatId = rawChat.trim();
		if (!threadId && rawThread && !isNaN(Number(rawThread.trim()))) {
			threadId = Number(rawThread.trim());
		}
	}
	return {
		chatId,
		messageThreadId: threadId && !isNaN(threadId) ? threadId : undefined,
	};
}

async function send(env: Env, event: NotificationEvent): Promise<void> {
	const text = formatNotification(event);
	const { chatId, messageThreadId } = parseChatAndThread(env);

	const payload: Record<string, unknown> = {
		chat_id: chatId,
		text,
		disable_web_page_preview: true,
	};
	if (messageThreadId !== undefined) {
		payload.message_thread_id = messageThreadId;
	}

	const response = await fetch(
		`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
		{
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(payload),
		},
	);
	if (!response.ok) {
		const body = await response.text();
		try {
			const errJson = JSON.parse(body) as {
				parameters?: { migrate_to_chat_id?: number };
			};
			if (errJson?.parameters?.migrate_to_chat_id) {
				payload.chat_id = String(errJson.parameters.migrate_to_chat_id);
				const retryResp = await fetch(
					`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
					{
						method: 'POST',
						headers: { 'content-type': 'application/json' },
						body: JSON.stringify(payload),
					},
				);
				if (retryResp.ok) {
					return;
				}
			}
		} catch {
			// ignore JSON parse errors
		}
		throw new Error(`Telegram send failed: ${response.status} ${body}`);
	}
}

export const telegramTransport: NotifierTransport = {
	id: 'telegram',
	isConfigured,
	send,
};
