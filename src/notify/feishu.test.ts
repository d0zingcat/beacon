import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	buildFeishuTextPayload,
	feishuTransport,
	isFeishuRateLimitError,
} from './feishu';

function mockDb(): D1Database {
	const data = new Map<string, number>();
	return {
		prepare(sql: string) {
			return {
				bind(...params: unknown[]) {
					return {
						async first<T>() {
							if (sql.includes('SELECT next_available_at')) {
								const channel = params[0] as string;
								const value = data.get(channel);
								if (value === undefined) {
									return null;
								}
								return { next_available_at: value } as T;
							}
							return null;
						},
						async run() {
							if (sql.includes('INSERT INTO notify_rate_limit')) {
								const channel = params[0] as string;
								const nextAvailableAt = params[1] as number;
								if (data.has(channel)) {
									return { meta: { changes: 0 } };
								}
								data.set(channel, nextAvailableAt);
								return { meta: { changes: 1 } };
							}
							if (sql.includes('UPDATE notify_rate_limit')) {
								const newNext = params[0] as number;
								const channel = params[1] as string;
								const expectedCurrent = params[2] as number;
								const current = data.get(channel);
								if (current !== expectedCurrent) {
									return { meta: { changes: 0 } };
								}
								data.set(channel, newNext);
								return { meta: { changes: 1 } };
							}
							return { meta: { changes: 0 } };
						},
					};
				},
			};
		},
	} as D1Database;
}

function env(): Env {
	return {
		FEISHU_WEBHOOK_URL: 'https://open.feishu.cn/open-apis/bot/v2/hook/test',
		DB: mockDb(),
	} as Env;
}

describe('buildFeishuTextPayload', () => {
	it('builds text message payload', () => {
		expect(buildFeishuTextPayload('hello')).toBe(
			JSON.stringify({
				msg_type: 'text',
				content: { text: 'hello' },
			}),
		);
	});
});

describe('isFeishuRateLimitError', () => {
	it('detects 11232 and frequency limited messages', () => {
		expect(isFeishuRateLimitError(11232, 'frequency limited')).toBe(true);
		expect(isFeishuRateLimitError(undefined, 'frequency limited psm')).toBe(true);
		expect(isFeishuRateLimitError(9499, 'bad request')).toBe(false);
	});
});

describe('feishuTransport', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.useRealTimers();
	});

	it('is configured when webhook url is set', () => {
		expect(feishuTransport.isConfigured(env())).toBe(true);
		expect(feishuTransport.isConfigured({} as Env)).toBe(false);
	});

	it('sends message to webhook url', async () => {
		const fetch = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ code: 0, msg: 'success' }), { status: 200 }),
		);
		vi.stubGlobal('fetch', fetch);

		await feishuTransport.send(env(), 'hello beacon');

		expect(fetch).toHaveBeenCalledWith(env().FEISHU_WEBHOOK_URL, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: buildFeishuTextPayload('hello beacon'),
		});
	});

	it('throws when http status is not ok', async () => {
		const fetch = vi
			.fn()
			.mockResolvedValue(new Response('gateway error', { status: 502 }));
		vi.stubGlobal('fetch', fetch);

		await expect(feishuTransport.send(env(), 'hello')).rejects.toThrow(
			'Feishu send failed: 502 gateway error',
		);
	});

	it('throws when response code is not zero', async () => {
		const fetch = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ code: 9499, msg: 'bad request' }), { status: 200 }),
		);
		vi.stubGlobal('fetch', fetch);

		await expect(feishuTransport.send(env(), 'hello')).rejects.toThrow(
			'Feishu send failed: 9499 bad request',
		);
	});

	it('retries on rate limit errors', async () => {
		vi.useFakeTimers();
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						code: 11232,
						msg: 'frequency limited psm[lark.oapi.app_platform_runtime]appID[1500]',
					}),
					{ status: 200 },
				),
			)
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ code: 0, msg: 'success' }), { status: 200 }),
			);
		vi.stubGlobal('fetch', fetch);

		const sendPromise = feishuTransport.send(env(), 'hello');
		await vi.runAllTimersAsync();
		await sendPromise;

		expect(fetch).toHaveBeenCalledTimes(2);
	});
});
