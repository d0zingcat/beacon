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

const COLLIDING_GUID_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title>New feature</title>
      <link>https://docs.aws.amazon.com/bedrock/latest/userguide/a.html</link>
      <guid isPermaLink="false">https://docs.aws.amazon.com/bedrock/latest/userguide/#New_feature_2025-12-03</guid>
      <description>Feature A description</description>
      <pubDate>Wed, 03 Dec 2025 19:00:00 GMT</pubDate>
    </item>
    <item>
      <title>New feature</title>
      <link>https://docs.aws.amazon.com/bedrock/latest/userguide/b.html</link>
      <guid isPermaLink="false">https://docs.aws.amazon.com/bedrock/latest/userguide/#New_feature_2025-12-03</guid>
      <description>Feature B description</description>
      <pubDate>Wed, 03 Dec 2025 19:00:00 GMT</pubDate>
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

	it('uses guid as externalId by default even when guids collide', () => {
		const items = parseRssFeed(COLLIDING_GUID_RSS);
		expect(items.map((item) => item.externalId)).toEqual([
			'https://docs.aws.amazon.com/bedrock/latest/userguide/#New_feature_2025-12-03',
			'https://docs.aws.amazon.com/bedrock/latest/userguide/#New_feature_2025-12-03',
		]);
	});

	it('builds stable externalIds from guid, link, title, and summary', () => {
		const items = parseRssFeed(COLLIDING_GUID_RSS, { externalIdMode: 'stable' });
		expect(items.map((item) => item.externalId)).toEqual([
			[
				'https://docs.aws.amazon.com/bedrock/latest/userguide/#New_feature_2025-12-03',
				'https://docs.aws.amazon.com/bedrock/latest/userguide/a.html',
				'New feature',
				'Feature A description',
			].join('\n'),
			[
				'https://docs.aws.amazon.com/bedrock/latest/userguide/#New_feature_2025-12-03',
				'https://docs.aws.amazon.com/bedrock/latest/userguide/b.html',
				'New feature',
				'Feature B description',
			].join('\n'),
		]);
		expect(new Set(items.map((item) => item.externalId)).size).toBe(2);
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
