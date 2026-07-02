import { describe, expect, it } from 'vitest';
import { parseRssFeed } from '../../extract/feed';

const SAMPLE_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title><![CDATA[OpenAI News]]></title>
    <item>
      <title><![CDATA[How ChatGPT adoption has expanded]]></title>
      <description><![CDATA[New OpenAI Signals data shows how ChatGPT adoption is growing globally, with users increasing usage, exploring more capabilities, and driving growth across regions and languages.]]></description>
      <link>https://openai.com/index/how-chatgpt-adoption-has-expanded</link>
      <guid isPermaLink="true">https://openai.com/index/how-chatgpt-adoption-has-expanded</guid>
      <pubDate>Tue, 30 Jun 2026 09:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

describe('openai-blog RSS', () => {
	it('parses openai blog feed items', () => {
		const items = parseRssFeed(SAMPLE_RSS);

		expect(items).toEqual([
			{
				externalId: 'https://openai.com/index/how-chatgpt-adoption-has-expanded',
				url: 'https://openai.com/index/how-chatgpt-adoption-has-expanded',
				title: 'How ChatGPT adoption has expanded',
				summary:
					'New OpenAI Signals data shows how ChatGPT adoption is growing globally, with users increasing usage, exploring more capabilities, and driving growth across regions and languages.',
				publishedAt: new Date('Tue, 30 Jun 2026 09:00:00 GMT').toISOString(),
			},
		]);
	});
});
