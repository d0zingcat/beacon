import { describe, expect, it, vi } from 'vitest';
import { createFeedExtractor, parseRssFeed } from './feed';

const SAMPLE_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Example Feed</title>
    <item>
      <title>First Post</title>
      <link>https://example.com/posts/1</link>
      <guid>https://example.com/posts/1</guid>
      <description>Summary text</description>
    </item>
  </channel>
</rss>`;

describe('parseRssFeed', () => {
	it('parses rss items', () => {
		expect(parseRssFeed(SAMPLE_RSS)).toEqual([
			{
				externalId: 'https://example.com/posts/1',
				url: 'https://example.com/posts/1',
				title: 'First Post',
				summary: 'Summary text',
				publishedAt: undefined,
			},
		]);
	});
});

describe('createFeedExtractor', () => {
	it('fetches feed url and parses items', async () => {
		const fetch = vi.fn().mockResolvedValue(new Response(SAMPLE_RSS, { status: 200 }));
		const extractor = createFeedExtractor({
			feedUrl: 'https://example.com/feed.xml',
			headers: { accept: 'application/rss+xml' },
		});

		const items = await extractor.extract({ env: {} as Env, fetch });

		expect(extractor.kind).toBe('feed');
		expect(fetch).toHaveBeenCalledWith('https://example.com/feed.xml', {
			headers: { accept: 'application/rss+xml' },
		});
		expect(items).toHaveLength(1);
		expect(items[0]?.title).toBe('First Post');
	});

	it('throws when feed fetch fails', async () => {
		const fetch = vi
			.fn()
			.mockResolvedValue(new Response('error', { status: 503, statusText: 'Unavailable' }));
		const extractor = createFeedExtractor({ feedUrl: 'https://example.com/feed.xml' });

		await expect(extractor.extract({ env: {} as Env, fetch })).rejects.toThrow(
			'RSS fetch failed: 503 Unavailable',
		);
	});
});
