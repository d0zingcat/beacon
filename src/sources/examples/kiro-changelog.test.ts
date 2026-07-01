import { describe, expect, it } from 'vitest';
import { parseRssFeed } from '../rss';

const SAMPLE_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Kiro Changelog</title>
    <item>
      <title>Models: Claude Sonnet 5 Now Available</title>
      <link>https://kiro.dev/changelog/models/sonnet-5</link>
      <guid>https://kiro.dev/changelog/models/sonnet-5</guid>
      <pubDate>Wed, 01 Jul 2026 01:30:00 GMT</pubDate>
      <description><![CDATA[Claude Sonnet 5 is now available in the Kiro IDE.]]></description>
    </item>
  </channel>
</rss>`;

describe('kiro-changelog RSS', () => {
	it('parses kiro changelog feed items', () => {
		const items = parseRssFeed(SAMPLE_RSS);

		expect(items).toEqual([
			{
				externalId: 'https://kiro.dev/changelog/models/sonnet-5',
				url: 'https://kiro.dev/changelog/models/sonnet-5',
				title: 'Models: Claude Sonnet 5 Now Available',
				summary: 'Claude Sonnet 5 is now available in the Kiro IDE.',
				publishedAt: new Date('Wed, 01 Jul 2026 01:30:00 GMT').toISOString(),
			},
		]);
	});
});
