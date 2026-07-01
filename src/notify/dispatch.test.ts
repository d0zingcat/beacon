import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dispatchNotifications } from './dispatch';
import type { NotifierTransport } from './transport';

vi.mock('./transport', () => ({
	createTransports: vi.fn(),
}));

vi.mock('../db/repo', () => ({
	markItemNotified: vi.fn(),
}));

import { markItemNotified } from '../db/repo';
import { createTransports } from './transport';

function mockDb() {
	return {
		prepare: vi.fn(),
	} as unknown as import('../db/client').Db;
}

function mockTransport(
	overrides: Partial<NotifierTransport> & { id: NotifierTransport['id'] },
): NotifierTransport {
	return {
		isConfigured: () => true,
		send: vi.fn().mockResolvedValue(undefined),
		...overrides,
	};
}

const appendEvent = {
	kind: 'append' as const,
	sourceId: 'test',
	sourceName: 'Test',
	itemId: 42,
	title: 'Title',
};

describe('dispatchNotifications', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('skips when no transports configured', async () => {
		vi.mocked(createTransports).mockReturnValue([]);
		await dispatchNotifications({} as Env, mockDb(), [appendEvent]);
		expect(createTransports).toHaveBeenCalled();
		expect(markItemNotified).not.toHaveBeenCalled();
	});

	it('skips suppressed crawl_error events', async () => {
		const send = vi.fn().mockResolvedValue(undefined);
		vi.mocked(createTransports).mockReturnValue([
			mockTransport({ id: 'telegram', send }),
		]);
		await dispatchNotifications({} as Env, mockDb(), [
			{
				kind: 'crawl_error',
				sourceId: 'test',
				sourceName: 'Test',
				error: 'failed',
				suppress: true,
			},
		]);
		expect(send).not.toHaveBeenCalled();
	});

	it('fans out to all configured transports', async () => {
		const telegramSend = vi.fn().mockResolvedValue(undefined);
		const feishuSend = vi.fn().mockResolvedValue(undefined);
		vi.mocked(createTransports).mockReturnValue([
			mockTransport({ id: 'telegram', send: telegramSend }),
			mockTransport({ id: 'feishu', send: feishuSend }),
		]);
		await dispatchNotifications({} as Env, mockDb(), [
			{
				kind: 'crawl_error',
				sourceId: 'test',
				sourceName: 'Test',
				error: 'failed',
			},
		]);
		expect(telegramSend).toHaveBeenCalledOnce();
		expect(feishuSend).toHaveBeenCalledOnce();
	});

	it('marks item notified when append succeeds on any transport', async () => {
		const db = mockDb();
		vi.mocked(createTransports).mockReturnValue([
			mockTransport({
				id: 'telegram',
				send: vi.fn().mockResolvedValue(undefined),
			}),
			mockTransport({
				id: 'feishu',
				send: vi.fn().mockRejectedValue(new Error('feishu down')),
			}),
		]);

		await dispatchNotifications({} as Env, db, [appendEvent]);

		expect(markItemNotified).toHaveBeenCalledWith(db, 42);
	});

	it('does not mark item notified when all transports fail', async () => {
		vi.mocked(createTransports).mockReturnValue([
			mockTransport({
				id: 'telegram',
				send: vi.fn().mockRejectedValue(new Error('telegram down')),
			}),
			mockTransport({
				id: 'feishu',
				send: vi.fn().mockRejectedValue(new Error('feishu down')),
			}),
		]);

		await dispatchNotifications({} as Env, mockDb(), [appendEvent]);

		expect(markItemNotified).not.toHaveBeenCalled();
	});
});
