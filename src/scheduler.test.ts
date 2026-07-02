import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearDynamicSources, registerDynamicSource } from './sources/registry';
import type { Source } from './sources/types';
import { runScheduler, selectSourcesForTick } from './scheduler';

function makeSource(id: string): Source {
	return {
		id,
		name: id,
		kind: 'webpage',
		mode: 'append',
		async fetch() {
			return [];
		},
	};
}

function tick(iso: string): number {
	return new Date(iso).getTime();
}

function idsFor(wranglerCron: string): string[] {
	return selectSourcesForTick(wranglerCron)
		.map((source) => source.id)
		.sort();
}

describe('selectSourcesForTick', () => {
	beforeEach(() => {
		clearDynamicSources();
	});

	it('runs hourly sources on the hourly Cloudflare cron', () => {
		registerDynamicSource(makeSource('cursor-blog'));
		registerDynamicSource(makeSource('openai-blog'));
		registerDynamicSource(makeSource('dmit-stock'));
		registerDynamicSource(makeSource('bedrock-models'));

		expect(idsFor('0 * * * *')).toEqual(['cursor-blog', 'openai-blog']);
	});

	it('runs quarter-hour sources on the */15 Cloudflare cron', () => {
		registerDynamicSource(makeSource('cursor-blog'));
		registerDynamicSource(makeSource('dmit-stock'));

		expect(idsFor('*/15 * * * *')).toEqual(['dmit-stock']);
	});

	it('runs six-hourly sources on the 6-hour Cloudflare cron', () => {
		registerDynamicSource(makeSource('cursor-blog'));
		registerDynamicSource(makeSource('bedrock-models'));

		expect(idsFor('0 */6 * * *')).toEqual(['bedrock-models']);
	});

	it('includes db-managed feed sources on the hourly cron', () => {
		registerDynamicSource({ ...makeSource('my-feed'), kind: 'feed' });

		expect(idsFor('0 * * * *')).toEqual(['my-feed']);
		expect(idsFor('*/15 * * * *')).toEqual([]);
	});
});

describe('runScheduler', () => {
	beforeEach(() => {
		clearDynamicSources();
	});

	it('enqueues matched sources with scheduledTime', async () => {
		registerDynamicSource(makeSource('cursor-blog'));
		registerDynamicSource(makeSource('dmit-stock'));

		const scheduledTime = tick('2026-07-02T06:00:00Z');
		const send = vi.fn().mockResolvedValue(undefined);
		const env = { CRAWL_QUEUE: { send } } as unknown as Env;

		await runScheduler(env, '0 * * * *', scheduledTime);

		expect(send).toHaveBeenCalledOnce();
		expect(send).toHaveBeenCalledWith({ sourceId: 'cursor-blog', triggeredAt: scheduledTime });
	});
});
