import { describe, expect, it, vi } from 'vitest';
import type { Db } from '../db/client';
import type { NotificationEvent } from '../notify/types';
import { dispatchUserSubscriptions } from './dispatch';
import type { SubscribedChannelRow } from './repo';

const CHANNEL: SubscribedChannelRow = {
	id: 3,
	user_id: 7,
	display_name: 'My bot',
	webhook_ciphertext: 'encrypted',
	webhook_fingerprint: 'fingerprint',
	webhook_mask: 'https://open.feishu.cn/open-apis/bot/v2/hook/test...hook',
	status: 'active',
	consecutive_failures: 0,
	last_test_at: null,
	last_error: null,
	created_at: 1,
	updated_at: 1,
	source_id: 'cursor-blog',
};

const EVENT: NotificationEvent = {
	kind: 'append',
	sourceId: 'cursor-blog',
	sourceName: 'Cursor Blog',
	sourceKind: 'webpage',
	itemId: 42,
	title: 'Cursor on iOS',
	url: 'https://cursor.com/blog/ios-mobile-app',
};

describe('dispatchUserSubscriptions', () => {
	it('sends events only to channels subscribed to the source', async () => {
		const sendWebhook = vi.fn().mockResolvedValue(undefined);
		const insertDelivery = vi.fn().mockResolvedValue(true);
		const updateDeliveryStatus = vi.fn().mockResolvedValue(undefined);

		await dispatchUserSubscriptions({ WEBHOOK_ENCRYPTION_KEY: 'key' } as Env, {} as Db, [EVENT], {
			listActiveChannelsForSource: vi.fn().mockResolvedValue([CHANNEL]),
			decryptSecret: vi.fn().mockResolvedValue('https://open.feishu.cn/open-apis/bot/v2/hook/test'),
			sendWebhook,
			insertDelivery,
			updateDeliveryStatus,
			resetChannelFailures: vi.fn().mockResolvedValue(undefined),
		});

		expect(sendWebhook).toHaveBeenCalledTimes(1);
		expect(insertDelivery).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
			channelId: 3,
			sourceId: 'cursor-blog',
			eventKind: 'append',
			itemId: 42,
			eventKey: 'append:42',
			status: 'skipped',
		}));
		expect(updateDeliveryStatus).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
			channelId: 3,
			eventKey: 'append:42',
			status: 'sent',
		}));
	});

	it('skips send when delivery dedupe already exists', async () => {
		const sendWebhook = vi.fn();

		await dispatchUserSubscriptions({ WEBHOOK_ENCRYPTION_KEY: 'key' } as Env, {} as Db, [EVENT], {
			listActiveChannelsForSource: vi.fn().mockResolvedValue([CHANNEL]),
			decryptSecret: vi.fn().mockResolvedValue('https://open.feishu.cn/open-apis/bot/v2/hook/test'),
			sendWebhook,
			insertDelivery: vi.fn().mockResolvedValue(false),
		});

		expect(sendWebhook).not.toHaveBeenCalled();
	});

	it('records failed sends and channel failures', async () => {
		const recordChannelFailure = vi.fn().mockResolvedValue(undefined);
		const updateDeliveryStatus = vi.fn().mockResolvedValue(undefined);

		await dispatchUserSubscriptions({ WEBHOOK_ENCRYPTION_KEY: 'key' } as Env, {} as Db, [EVENT], {
			listActiveChannelsForSource: vi.fn().mockResolvedValue([CHANNEL]),
			decryptSecret: vi.fn().mockResolvedValue('https://open.feishu.cn/open-apis/bot/v2/hook/test'),
			sendWebhook: vi.fn().mockRejectedValue(new Error('Feishu unavailable')),
			insertDelivery: vi.fn().mockResolvedValue(true),
			updateDeliveryStatus,
			recordChannelFailure,
		});

		expect(updateDeliveryStatus).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
			channelId: 3,
			eventKey: 'append:42',
			status: 'failed',
			error: 'Feishu unavailable',
		}));
		expect(recordChannelFailure).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
			channelId: 3,
			error: 'Feishu unavailable',
			disableAtFailures: 5,
		}));
	});
});
