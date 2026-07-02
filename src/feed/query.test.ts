import { describe, expect, it } from 'vitest';
import type { Source } from '../sources/types';
import { buildFeedChannel, buildFeedUrl, parseSourceIds, validateFeedSources } from './query';

const APPEND_SOURCE: Source = {
	id: 'cursor-blog',
	name: 'Cursor Blog',
	kind: 'webpage',
	mode: 'append',
	fetch: async () => [],
};

const STATE_SOURCE: Source = {
	id: 'dmit-stock',
	name: 'DMIT VPS Stock',
	kind: 'webpage',
	mode: 'state',
	fetch: async () => [],
};

const CHANGELOG_SOURCE: Source = {
	id: 'cursor-changelog',
	name: 'Cursor Changelog',
	kind: 'webpage',
	mode: 'append',
	fetch: async () => [],
};

function createGetSource(sources: Source[]) {
	const byId = new Map(sources.map((source) => [source.id, source]));
	return (id: string) => byId.get(id);
}

describe('parseSourceIds', () => {
	it('returns undefined when source param is missing or blank', () => {
		expect(parseSourceIds(undefined)).toBeUndefined();
		expect(parseSourceIds('')).toBeUndefined();
		expect(parseSourceIds('   ')).toBeUndefined();
		expect(parseSourceIds(', ,')).toBeUndefined();
	});

	it('parses a single source id', () => {
		expect(parseSourceIds('cursor-blog')).toEqual(['cursor-blog']);
	});

	it('parses comma-separated source ids with trimming and dedupe', () => {
		expect(parseSourceIds(' cursor-blog , cursor-changelog ,cursor-blog ')).toEqual([
			'cursor-blog',
			'cursor-changelog',
		]);
	});
});

describe('validateFeedSources', () => {
	it('accepts missing source ids as all append sources', () => {
		expect(validateFeedSources(undefined, createGetSource([]))).toEqual({
			ok: true,
			sourceIds: undefined,
		});
	});

	it('rejects unknown source ids', () => {
		expect(
			validateFeedSources(['cursor-blog'], createGetSource([])),
		).toEqual({
			ok: false,
			status: 404,
			error: 'Source not found',
			sourceId: 'cursor-blog',
		});
	});

	it('rejects state sources', () => {
		expect(
			validateFeedSources(['dmit-stock'], createGetSource([STATE_SOURCE])),
		).toEqual({
			ok: false,
			status: 400,
			error: 'Only append sources are supported in feed',
			sourceId: 'dmit-stock',
		});
	});

	it('validates every source in a comma-separated list', () => {
		const getSource = createGetSource([APPEND_SOURCE, CHANGELOG_SOURCE, STATE_SOURCE]);

		expect(validateFeedSources(['cursor-blog', 'cursor-changelog'], getSource)).toEqual({
			ok: true,
			sourceIds: ['cursor-blog', 'cursor-changelog'],
		});

		expect(validateFeedSources(['cursor-blog', 'dmit-stock'], getSource)).toEqual({
			ok: false,
			status: 400,
			error: 'Only append sources are supported in feed',
			sourceId: 'dmit-stock',
		});
	});
});

describe('buildFeedChannel', () => {
	const getSource = createGetSource([APPEND_SOURCE, CHANGELOG_SOURCE]);

	it('builds the default aggregated channel', () => {
		expect(buildFeedChannel(undefined, 'https://example.com/feed', getSource)).toEqual({
			title: 'Beacon',
			link: 'https://example.com/feed',
			description: 'Aggregated append feed from beacon',
		});
	});

	it('builds a single-source channel', () => {
		expect(
			buildFeedChannel(['cursor-blog'], 'https://example.com/feed?source=cursor-blog', getSource),
		).toEqual({
			title: 'Cursor Blog',
			link: 'https://example.com/feed?source=cursor-blog',
			description: 'Cursor Blog feed from beacon',
		});
	});

	it('builds a combined channel for multiple sources', () => {
		expect(
			buildFeedChannel(
				['cursor-blog', 'cursor-changelog'],
				'https://example.com/feed?source=cursor-blog,cursor-changelog',
				getSource,
			),
		).toEqual({
			title: 'Cursor Blog + Cursor Changelog',
			link: 'https://example.com/feed?source=cursor-blog,cursor-changelog',
			description: 'Combined feed: Cursor Blog, Cursor Changelog',
		});
	});
});

describe('buildFeedUrl', () => {
	it('preserves comma-separated source ids in the feed url', () => {
		expect(
			buildFeedUrl('https://example.com/feed?limit=20', ['cursor-blog', 'cursor-changelog']),
		).toBe('https://example.com/feed?source=cursor-blog%2Ccursor-changelog');
	});
});
