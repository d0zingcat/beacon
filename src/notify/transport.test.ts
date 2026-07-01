import { describe, expect, it } from 'vitest';
import { createTransports } from './transport';

function env(overrides: Partial<Env>): Env {
	return {
		TELEGRAM_BOT_TOKEN: '',
		TELEGRAM_CHAT_ID: '',
		FEISHU_WEBHOOK_URL: '',
		...overrides,
	} as Env;
}

describe('createTransports', () => {
	it('returns telegram when only telegram is configured', () => {
		const transports = createTransports(
			env({ TELEGRAM_BOT_TOKEN: 'token', TELEGRAM_CHAT_ID: 'chat' }),
		);
		expect(transports.map((t) => t.id)).toEqual(['telegram']);
	});

	it('returns feishu when only feishu is configured', () => {
		const transports = createTransports(
			env({ FEISHU_WEBHOOK_URL: 'https://open.feishu.cn/open-apis/bot/v2/hook/test' }),
		);
		expect(transports.map((t) => t.id)).toEqual(['feishu']);
	});

	it('returns both when both are configured', () => {
		const transports = createTransports(
			env({
				TELEGRAM_BOT_TOKEN: 'token',
				TELEGRAM_CHAT_ID: 'chat',
				FEISHU_WEBHOOK_URL: 'https://open.feishu.cn/open-apis/bot/v2/hook/test',
			}),
		);
		expect(transports.map((t) => t.id)).toEqual(['telegram', 'feishu']);
	});

	it('returns empty when nothing is configured', () => {
		expect(createTransports(env({}))).toEqual([]);
	});
});
