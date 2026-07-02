import { describe, expect, it } from 'vitest';
import { parseRssFeed } from '../../extract/feed';

const SAMPLE_RSS = `<?xml version="1.0" encoding="UTF-8"?>
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

describe('openrouter-blog RSS', () => {
	it('parses openrouter blog feed items', () => {
		const items = parseRssFeed(SAMPLE_RSS);

		expect(items).toEqual([
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
