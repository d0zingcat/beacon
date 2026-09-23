import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatNotification } from './format';
import { telegramTransport } from './telegram';

function env(): Env {
	return {
		TELEGRAM_BOT_TOKEN: 'bot-token',
		TELEGRAM_CHAT_ID: 'chat-id',
	} as Env;
}

describe('telegramTransport', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('is configured when token and chat id are set', () => {
		expect(telegramTransport.isConfigured(env())).toBe(true);
		expect(
			telegramTransport.isConfigured({ TELEGRAM_BOT_TOKEN: 'x' } as Env),
		).toBe(false);
	});

	it('sends message with expected payload', async () => {
		const fetch = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
		vi.stubGlobal('fetch', fetch);

		const event = {
			kind: 'append' as const,
			sourceId: 'test',
			sourceName: 'Test',
			itemId: 1,
			title: 'hello beacon',
		};
		await telegramTransport.send(env(), event);

		expect(fetch).toHaveBeenCalledWith(
			'https://api.telegram.org/botbot-token/sendMessage',
			{
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					chat_id: 'chat-id',
					text: formatNotification(event),
					disable_web_page_preview: true,
				}),
			},
		);
	});

	it('throws when telegram api returns non-2xx', async () => {
		const fetch = vi
			.fn()
			.mockResolvedValue(new Response('bad request', { status: 400 }));
		vi.stubGlobal('fetch', fetch);

		await expect(
			telegramTransport.send(env(), {
				kind: 'crawl_error',
				sourceId: 'test',
				sourceName: 'Test',
				error: 'hello',
			}),
		).rejects.toThrow('Telegram send failed: 400 bad request');
	});

	it('supports message_thread_id from env', async () => {
		const fetch = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
		vi.stubGlobal('fetch', fetch);

		const customEnv = {
			...env(),
			TELEGRAM_MESSAGE_THREAD_ID: '6',
		};
		const event = {
			kind: 'append' as const,
			sourceId: 'test',
			sourceName: 'Test',
			itemId: 1,
			title: 'hello topic',
		};
		await telegramTransport.send(customEnv, event);

		expect(fetch).toHaveBeenCalledWith(
			'https://api.telegram.org/botbot-token/sendMessage',
			expect.objectContaining({
				body: JSON.stringify({
					chat_id: 'chat-id',
					text: formatNotification(event),
					disable_web_page_preview: true,
					message_thread_id: 6,
				}),
			}),
		);
	});

	it('parses chat_id with inline thread id', async () => {
		const fetch = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
		vi.stubGlobal('fetch', fetch);

		const customEnv = {
			...env(),
			TELEGRAM_CHAT_ID: '-1004490706097:6',
		};
		const event = {
			kind: 'append' as const,
			sourceId: 'test',
			sourceName: 'Test',
			itemId: 1,
			title: 'hello inline thread',
		};
		await telegramTransport.send(customEnv, event);

		expect(fetch).toHaveBeenCalledWith(
			'https://api.telegram.org/botbot-token/sendMessage',
			expect.objectContaining({
				body: JSON.stringify({
					chat_id: '-1004490706097',
					text: formatNotification(event),
					disable_web_page_preview: true,
					message_thread_id: 6,
				}),
			}),
		);
	});

	it('auto-heals and retries when Telegram returns migrate_to_chat_id', async () => {
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						ok: false,
						error_code: 400,
						description: 'Bad Request: group chat was upgraded to a supergroup chat',
						parameters: { migrate_to_chat_id: -1004490706097 },
					}),
					{ status: 400 },
				),
			)
			.mockResolvedValueOnce(new Response('{"ok": true}', { status: 200 }));
		vi.stubGlobal('fetch', fetch);

		const event = {
			kind: 'append' as const,
			sourceId: 'test',
			sourceName: 'Test',
			itemId: 1,
			title: 'hello migrated',
		};
		await telegramTransport.send(env(), event);

		expect(fetch).toHaveBeenCalledTimes(2);
		expect(fetch).toHaveBeenNthCalledWith(
			2,
			'https://api.telegram.org/botbot-token/sendMessage',
			expect.objectContaining({
				body: JSON.stringify({
					chat_id: '-1004490706097',
					text: formatNotification(event),
					disable_web_page_preview: true,
				}),
			}),
		);
	});
});
