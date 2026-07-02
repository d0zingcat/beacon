import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	buildFeishuNotificationPayload,
	buildFeishuTextPayload,
	feishuTransport,
	isFeishuRateLimitError,
} from './feishu';
import { formatPublishedAt } from './format-time';

const publishedAt = Date.parse('2026-07-01T01:30:00.000Z');

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

describe('buildFeishuNotificationPayload', () => {
	it('builds append post with clickable title and published time', () => {
		expect(
			JSON.parse(
				buildFeishuNotificationPayload({
					kind: 'append',
					sourceId: 'kiro-changelog',
					sourceName: 'Kiro Changelog',
					itemId: 1,
					title: 'New feature',
					url: 'https://example.com/post',
					summary: 'A short summary',
					publishedAt,
				}),
			),
		).toEqual({
			msg_type: 'post',
			content: {
				post: {
					zh_cn: {
						title: '📰 新条目 · Kiro Changelog',
						content: [
							[
								{
									tag: 'a',
									text: 'New feature',
									href: 'https://example.com/post',
								},
								{ tag: 'text', text: ` · ${formatPublishedAt(publishedAt)}` },
							],
							[{ tag: 'text', text: 'A short summary' }],
						],
					},
				},
			},
		});
	});

	it('builds append post with clickable title and no url line', () => {
		expect(
			JSON.parse(
				buildFeishuNotificationPayload({
					kind: 'append',
					sourceId: 'kiro-changelog',
					sourceName: 'Kiro Changelog',
					itemId: 1,
					title: 'New feature',
					url: 'https://example.com/post',
					summary: 'A short summary',
				}),
			),
		).toEqual({
			msg_type: 'post',
			content: {
				post: {
					zh_cn: {
						title: '📰 新条目 · Kiro Changelog',
						content: [
							[
								{
									tag: 'a',
									text: 'New feature',
									href: 'https://example.com/post',
								},
							],
							[{ tag: 'text', text: 'A short summary' }],
						],
					},
				},
			},
		});
	});

	it('builds append post with plain title when url is missing', () => {
		const payload = JSON.parse(
			buildFeishuNotificationPayload({
				kind: 'append',
				sourceId: 'kiro-changelog',
				sourceName: 'Kiro Changelog',
				itemId: 1,
				title: 'New feature',
			}),
		);
		expect(payload.content.post.zh_cn.content[0]).toEqual([
			{ tag: 'text', text: 'New feature' },
		]);
	});

	it('builds dmit state_change post with diff lines and clickable title', () => {
		expect(
			JSON.parse(
				buildFeishuNotificationPayload({
					kind: 'state_change',
					sourceId: 'dmit-stock',
					sourceName: 'DMIT VPS Stock',
					itemId: 2,
					title: 'HKG.AS3.T1.TINY',
					url: 'https://www.dmit.io/aff.php?aff=23808&pid=201',
					summary: '$39.9/月',
					diff: { available: { from: false, to: true } },
				}),
			),
		).toEqual({
			msg_type: 'post',
			content: {
				post: {
					zh_cn: {
						title: '🔔 状态变化 · DMIT VPS Stock',
						content: [
							[
								{
									tag: 'a',
									text: 'HKG.AS3.T1.TINY',
									href: 'https://www.dmit.io/aff.php?aff=23808&pid=201',
								},
							],
							[{ tag: 'text', text: '📦 库存: ❌ 缺货 → ✅ 有货' }],
							[{ tag: 'text', text: '💰 价格: $39.9/月' }],
						],
					},
				},
			},
		});
	});

	it('builds generic state_change post with json diff', () => {
		const payload = JSON.parse(
			buildFeishuNotificationPayload({
				kind: 'state_change',
				sourceId: 'other-source',
				sourceName: 'Other Source',
				itemId: 3,
				title: 'Item A',
				url: 'https://example.com/item',
				diff: { status: { from: 'old', to: 'new' } },
			}),
		);
		expect(payload.content.post.zh_cn.content).toEqual([
			[{ tag: 'a', text: 'Item A', href: 'https://example.com/item' }],
			[
				{
					tag: 'text',
					text: '{\n  "status": {\n    "from": "old",\n    "to": "new"\n  }\n}',
				},
			],
		]);
	});

	it('builds crawl_error as plain text', () => {
		expect(
			JSON.parse(
				buildFeishuNotificationPayload({
					kind: 'crawl_error',
					sourceId: 'kiro-changelog',
					sourceName: 'Kiro Changelog',
					error: 'RSS fetch failed: 403 Forbidden',
				}),
			),
		).toEqual({
			msg_type: 'text',
			content: {
				text: [
					'⚠️ 抓取失败 · Kiro Changelog',
					'📌 source: kiro-changelog',
					'❌ RSS fetch failed: 403 Forbidden',
				].join('\n'),
			},
		});
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

	it('sends post payload for append events', async () => {
		const fetch = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ code: 0, msg: 'success' }), { status: 200 }),
		);
		vi.stubGlobal('fetch', fetch);

		const event = {
			kind: 'append' as const,
			sourceId: 'test',
			sourceName: 'Test',
			itemId: 1,
			title: 'Hello',
			url: 'https://example.com',
		};
		await feishuTransport.send(env(), event);

		expect(fetch).toHaveBeenCalledWith(env().FEISHU_WEBHOOK_URL, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: buildFeishuNotificationPayload(event),
		});
	});

	it('throws when http status is not ok', async () => {
		const fetch = vi
			.fn()
			.mockResolvedValue(new Response('gateway error', { status: 502 }));
		vi.stubGlobal('fetch', fetch);

		await expect(
			feishuTransport.send(env(), {
				kind: 'crawl_error',
				sourceId: 'test',
				sourceName: 'Test',
				error: 'failed',
			}),
		).rejects.toThrow('Feishu send failed: 502 gateway error');
	});

	it('throws when response code is not zero', async () => {
		const fetch = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ code: 9499, msg: 'bad request' }), { status: 200 }),
		);
		vi.stubGlobal('fetch', fetch);

		await expect(
			feishuTransport.send(env(), {
				kind: 'crawl_error',
				sourceId: 'test',
				sourceName: 'Test',
				error: 'failed',
			}),
		).rejects.toThrow('Feishu send failed: 9499 bad request');
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

		const sendPromise = feishuTransport.send(env(), {
			kind: 'crawl_error',
			sourceId: 'test',
			sourceName: 'Test',
			error: 'failed',
		});
		await vi.runAllTimersAsync();
		await sendPromise;

		expect(fetch).toHaveBeenCalledTimes(2);
	});
});
