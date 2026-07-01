import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildFeishuTextPayload, feishuTransport } from './feishu';

function env(): Env {
	return {
		FEISHU_WEBHOOK_URL: 'https://open.feishu.cn/open-apis/bot/v2/hook/test',
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

describe('feishuTransport', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
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
});
