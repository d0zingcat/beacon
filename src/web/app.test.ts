import { describe, expect, it, vi } from 'vitest';
import type { Source } from '../sources/types';
import { createAppRoutes } from './app';

const USER = { id: 7, email: 'user@example.com' };
const ENV = {} as Env;
const SOURCE: Source = {
	id: 'cursor-blog',
	name: 'Cursor Blog',
	kind: 'webpage',
	mode: 'append',
	fetch: async () => [],
};

describe('subscription app routes', () => {
	it('redirects anonymous users to login', async () => {
		const app = createAppRoutes({
			getCurrentUser: vi.fn().mockResolvedValue(null),
		});

		const response = await app.request('/app/subscriptions', undefined, ENV);

		expect(response.status).toBe(302);
		expect(response.headers.get('location')).toBe('/login');
	});

	it('renders subscriptions for logged-in users', async () => {
		const app = createAppRoutes({
			getCurrentUser: vi.fn().mockResolvedValue(USER),
			listSources: () => [SOURCE],
			listChannels: vi.fn().mockResolvedValue([]),
			listSubscriptions: vi.fn().mockResolvedValue([]),
		});

		const response = await app.request('/app/subscriptions', undefined, ENV);
		const body = await response.text();

		expect(response.status).toBe(200);
		expect(body).toContain('user@example.com');
		expect(body).toContain('Cursor Blog');
	});

	it('tests and stores a Feishu webhook for logged-in users', async () => {
		const saveFeishuChannel = vi.fn().mockResolvedValue(12);
		const sendTestMessage = vi.fn().mockResolvedValue(undefined);
		const app = createAppRoutes({
			getCurrentUser: vi.fn().mockResolvedValue(USER),
			saveFeishuChannel,
			sendTestMessage,
		});

		const response = await app.request(
			'/app/feishu-channels',
			{
				method: 'POST',
				headers: { 'content-type': 'application/x-www-form-urlencoded' },
				body: new URLSearchParams({
					displayName: 'My bot',
					webhookUrl: 'https://open.feishu.cn/open-apis/bot/v2/hook/abcdef',
				}),
			},
			ENV,
		);

		expect(response.status).toBe(302);
		expect(response.headers.get('location')).toBe('/app/subscriptions');
		expect(sendTestMessage).toHaveBeenCalledWith(
			expect.anything(),
			'https://open.feishu.cn/open-apis/bot/v2/hook/abcdef',
		);
		expect(saveFeishuChannel).toHaveBeenCalledWith(
			expect.anything(),
			USER,
			'My bot',
			'https://open.feishu.cn/open-apis/bot/v2/hook/abcdef',
		);
	});

	it('saves selected source subscriptions', async () => {
		const saveSubscriptions = vi.fn().mockResolvedValue(undefined);
		const app = createAppRoutes({
			getCurrentUser: vi.fn().mockResolvedValue(USER),
			saveSubscriptions,
		});

		const response = await app.request(
			'/app/subscriptions',
			{
				method: 'POST',
				headers: { 'content-type': 'application/x-www-form-urlencoded' },
				body: new URLSearchParams([
					['channelId', '12'],
					['sourceId', 'cursor-blog'],
					['sourceId', 'xai-news'],
				]),
			},
			ENV,
		);

		expect(response.status).toBe(302);
		expect(saveSubscriptions).toHaveBeenCalledWith(expect.anything(), USER, 12, [
			'cursor-blog',
			'xai-news',
		]);
	});
});
