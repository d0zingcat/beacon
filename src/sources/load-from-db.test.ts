import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildFeedSourceFromRow, createFeedExtractorFromConfig } from './load-from-db';
import { clearDynamicSources, getSource, listSources, registerDynamicSource } from './registry';
import { loadFeedSourcesFromDb } from './load-from-db';
import type { Db } from '../db/client';

vi.mock('../db/repo', () => ({
	listFeedSourceRows: vi.fn(),
}));

import { listFeedSourceRows } from '../db/repo';

const OPENAI_ROW = {
	id: 'openai-blog',
	name: 'OpenAI Blog',
	kind: 'feed' as const,
	mode: 'append' as const,
	config_json: '{"feedUrl":"https://openai.com/news/rss.xml"}',
	last_run_at: null,
	last_status: null,
	created_at: 1,
};

describe('load-from-db', () => {
	beforeEach(() => {
		clearDynamicSources();
		vi.mocked(listFeedSourceRows).mockReset();
	});

	it('builds feed source from db row', () => {
		const source = buildFeedSourceFromRow(OPENAI_ROW);
		expect(source).toMatchObject({
			id: 'openai-blog',
			name: 'OpenAI Blog',
			kind: 'feed',
			mode: 'append',
			batchNotifyMaxItems: 10,
		});
	});

	it('loads feed sources from db into dynamic registry', async () => {
		vi.mocked(listFeedSourceRows).mockResolvedValue([OPENAI_ROW]);
		await loadFeedSourcesFromDb({} as Db);

		expect(listSources().map((source) => source.id)).toContain('openai-blog');
		expect(getSource('openai-blog')?.kind).toBe('feed');
	});

	it('creates extractor with default headers', async () => {
		const fetch = vi.fn().mockResolvedValue(
			new Response(
				`<?xml version="1.0"?><rss version="2.0"><channel><item><title>T</title><guid>1</guid></item></channel></rss>`,
				{ status: 200 },
			),
		);
		const extractor = createFeedExtractorFromConfig({ feedUrl: 'https://example.com/feed.xml' });
		await extractor.extract({ env: {} as Env, fetch });

		expect(fetch).toHaveBeenCalledWith('https://example.com/feed.xml', {
			headers: expect.objectContaining({
				'user-agent': expect.stringContaining('beacon/'),
				accept: 'application/rss+xml, application/xml, text/xml',
			}),
		});
	});

	it('skips invalid feed rows', async () => {
		vi.mocked(listFeedSourceRows).mockResolvedValue([
			{ ...OPENAI_ROW, config_json: '{"feedUrl":"not-a-url"}' },
		]);
		await loadFeedSourcesFromDb({} as Db);
		expect(getSource('openai-blog')).toBeUndefined();
	});

	it('replaces stale dynamic sources on reload', async () => {
		registerDynamicSource({
			id: 'stale-feed',
			name: 'Stale',
			kind: 'feed',
			mode: 'append',
			fetch: vi.fn(),
		});
		vi.mocked(listFeedSourceRows).mockResolvedValue([OPENAI_ROW]);
		await loadFeedSourcesFromDb({} as Db);

		expect(getSource('stale-feed')).toBeUndefined();
		expect(getSource('openai-blog')).toBeDefined();
	});
});
