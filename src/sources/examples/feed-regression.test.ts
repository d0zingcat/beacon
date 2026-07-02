import { describe, expect, it } from 'vitest';
import { parseRssFeed } from '../../extract/feed';

const KIRO_RSS = `<?xml version="1.0" encoding="UTF-8"?>
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

const OPENAI_RSS = `<?xml version="1.0" encoding="UTF-8"?>
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

const OPENROUTER_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>OpenRouter Blog</title>
    <item>
      <title>The OpenRouter MCP Server</title>
      <link>https://openrouter.ai/blog/announcements/openrouter-mcp-server/</link>
      <guid isPermaLink="true">https://openrouter.ai/blog/announcements/openrouter-mcp-server/</guid>
      <description>Connect your coding agent to OpenRouter&apos;s live model catalog, benchmarks, docs, and test inference, all without leaving your editor.</description>
      <pubDate>Thu, 25 Jun 2026 00:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

describe('feed RSS regression fixtures', () => {
	it('parses kiro changelog feed items', () => {
		expect(parseRssFeed(KIRO_RSS)).toEqual([
			{
				externalId: 'https://kiro.dev/changelog/models/sonnet-5',
				url: 'https://kiro.dev/changelog/models/sonnet-5',
				title: 'Models: Claude Sonnet 5 Now Available',
				summary: 'Claude Sonnet 5 is now available in the Kiro IDE.',
				publishedAt: new Date('Wed, 01 Jul 2026 01:30:00 GMT').toISOString(),
			},
		]);
	});

	it('parses openai blog feed items', () => {
		expect(parseRssFeed(OPENAI_RSS)).toEqual([
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

	it('parses openrouter blog feed items', () => {
		expect(parseRssFeed(OPENROUTER_RSS)).toEqual([
			{
				externalId: 'https://openrouter.ai/blog/announcements/openrouter-mcp-server/',
				url: 'https://openrouter.ai/blog/announcements/openrouter-mcp-server/',
				title: 'The OpenRouter MCP Server',
				summary:
					"Connect your coding agent to OpenRouter&apos;s live model catalog, benchmarks, docs, and test inference, all without leaving your editor.",
				publishedAt: new Date('Thu, 25 Jun 2026 00:00:00 GMT').toISOString(),
			},
		]);
	});
});
