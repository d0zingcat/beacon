import { describe, expect, it, vi } from 'vitest';
import type { ItemRow } from '../db/repo';
import type { Source } from '../sources/types';
import { handleFeedRequest } from './handler';

const APPEND_SOURCE: Source = {
	id: 'cursor-blog',
	name: 'Cursor Blog',
	kind: 'webpage',
	mode: 'append',
	schedule: '0 * * * *',
	fetch: async () => [],
};

const CHANGELOG_SOURCE: Source = {
	id: 'cursor-changelog',
	name: 'Cursor Changelog',
	kind: 'webpage',
	mode: 'append',
	schedule: '0 * * * *',
	fetch: async () => [],
};

const STATE_SOURCE: Source = {
	id: 'dmit-stock',
	name: 'DMIT VPS Stock',
	kind: 'webpage',
	mode: 'state',
	schedule: '*/5 * * * *',
	fetch: async () => [],
};

const SAMPLE_ITEM: ItemRow = {
	id: 1,
	source_id: 'cursor-blog',
	external_id: 'ios-mobile-app',
	title: 'Cursor on iOS',
	url: 'https://cursor.com/blog/ios-mobile-app',
	summary: 'Native iOS app in public beta.',
	content: null,
	published_at: Date.parse('2026-06-30T00:00:00.000Z'),
	hash: 'abc',
	raw_json: null,
	notified: 0,
	state_json: null,
	prev_state_json: null,
	state_changed_at: null,
	updated_at: Date.parse('2026-06-30T00:00:00.000Z'),
	created_at: Date.parse('2026-06-30T00:00:00.000Z'),
};

function createGetSource(sources: Source[]) {
	const byId = new Map(sources.map((source) => [source.id, source]));
	return (id: string) => byId.get(id);
}

describe('handleFeedRequest', () => {
	it('returns rss xml for a single append source', async () => {
		const listItems = vi.fn().mockResolvedValue([SAMPLE_ITEM]);

		const result = await handleFeedRequest({
			reqUrl: 'https://example.com/feed',
			sourceParam: 'cursor-blog',
			limit: 20,
			sort: 'published_at',
			order: 'desc',
			getSource: createGetSource([APPEND_SOURCE]),
			listItems,
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		expect(listItems).toHaveBeenCalledWith({
			sourceIds: ['cursor-blog'],
			mode: 'append',
			limit: 20,
			sort: 'published_at',
			order: 'desc',
		});
		expect(result.xml).toContain('<title>Cursor Blog</title>');
		expect(result.xml).toContain('<link>https://example.com/feed?source=cursor-blog</link>');
		expect(result.xml).toContain('<title>Cursor on iOS</title>');
	});

	it('queries multiple comma-separated append sources', async () => {
		const listItems = vi.fn().mockResolvedValue([SAMPLE_ITEM]);

		const result = await handleFeedRequest({
			reqUrl: 'https://example.com/feed',
			sourceParam: 'cursor-blog, cursor-changelog',
			limit: 10,
			sort: 'published_at',
			order: 'desc',
			getSource: createGetSource([APPEND_SOURCE, CHANGELOG_SOURCE]),
			listItems,
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		expect(listItems).toHaveBeenCalledWith({
			sourceIds: ['cursor-blog', 'cursor-changelog'],
			mode: 'append',
			limit: 10,
			sort: 'published_at',
			order: 'desc',
		});
		expect(result.xml).toContain('<title>Cursor Blog + Cursor Changelog</title>');
		expect(result.xml).toContain(
			'<link>https://example.com/feed?source=cursor-blog%2Ccursor-changelog</link>',
		);
	});

	it('rejects unknown and state sources before querying items', async () => {
		const listItems = vi.fn();
		const getSource = createGetSource([APPEND_SOURCE, STATE_SOURCE]);

		expect(
			await handleFeedRequest({
				reqUrl: 'https://example.com/feed',
				sourceParam: 'missing-source',
				limit: 20,
				sort: 'published_at',
				order: 'desc',
				getSource,
				listItems,
			}),
		).toEqual({
			ok: false,
			status: 404,
			body: { error: 'Source not found', sourceId: 'missing-source' },
		});

		expect(
			await handleFeedRequest({
				reqUrl: 'https://example.com/feed',
				sourceParam: 'dmit-stock',
				limit: 20,
				sort: 'published_at',
				order: 'desc',
				getSource,
				listItems,
			}),
		).toEqual({
			ok: false,
			status: 400,
			body: {
				error: 'Only append sources are supported in feed',
				sourceId: 'dmit-stock',
			},
		});

		expect(listItems).not.toHaveBeenCalled();
	});

	it('returns validation errors for invalid sort and order', async () => {
		const listItems = vi.fn();

		expect(
			await handleFeedRequest({
				reqUrl: 'https://example.com/feed',
				limit: 20,
				sort: null,
				order: 'desc',
				getSource: createGetSource([]),
				listItems,
			}),
		).toEqual({
			ok: false,
			status: 400,
			body: {
				error: 'Invalid sort field',
				allowed: ['published_at', 'created_at', 'id', 'updated_at'],
			},
		});

		expect(
			await handleFeedRequest({
				reqUrl: 'https://example.com/feed',
				limit: 20,
				sort: 'published_at',
				order: null,
				getSource: createGetSource([]),
				listItems,
			}),
		).toEqual({
			ok: false,
			status: 400,
			body: { error: 'Invalid order', allowed: ['asc', 'desc'] },
		});
	});
});
