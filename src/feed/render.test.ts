import { describe, expect, it } from 'vitest';
import { escapeXml, mapItemRowToFeedItem, renderRssFeed } from './render';
import type { ItemRow } from '../db/repo';

const BASE_ITEM: ItemRow = {
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

describe('escapeXml', () => {
	it('escapes reserved characters', () => {
		expect(escapeXml(`Tom & Jerry <3> "quotes" 'ok'`)).toBe(
			'Tom &amp; Jerry &lt;3&gt; &quot;quotes&quot; &#39;ok&#39;',
		);
	});
});

describe('mapItemRowToFeedItem', () => {
	it('maps url, summary, and published date', () => {
		expect(mapItemRowToFeedItem(BASE_ITEM)).toEqual({
			title: 'Cursor on iOS',
			link: 'https://cursor.com/blog/ios-mobile-app',
			guid: 'https://cursor.com/blog/ios-mobile-app',
			description: 'Native iOS app in public beta.',
			pubDate: new Date('2026-06-30T00:00:00.000Z'),
		});
	});

	it('falls back to source and external id when url is missing', () => {
		const item = mapItemRowToFeedItem({ ...BASE_ITEM, url: null, summary: null, content: 'Body' });
		expect(item.guid).toBe('cursor-blog:ios-mobile-app');
		expect(item.description).toBe('Body');
	});
});

describe('renderRssFeed', () => {
	it('renders rss 2.0 xml', () => {
		const xml = renderRssFeed(
			{
				title: 'Cursor Blog',
				link: 'https://example.com/feed?source=cursor-blog',
				description: 'Cursor Blog feed from beacon',
			},
			[mapItemRowToFeedItem(BASE_ITEM)],
		);

		expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
		expect(xml).toContain('<rss version="2.0">');
		expect(xml).toContain('<title>Cursor Blog</title>');
		expect(xml).toContain('<link>https://cursor.com/blog/ios-mobile-app</link>');
		expect(xml).toContain('<description>Native iOS app in public beta.</description>');
		expect(xml).toContain(`<pubDate>${new Date('2026-06-30T00:00:00.000Z').toUTCString()}</pubDate>`);
	});
});
