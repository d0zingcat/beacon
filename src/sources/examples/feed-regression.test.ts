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

const LILIANWENG_RSS = `<?xml version="1.0" encoding="utf-8" standalone="yes"?>
<rss version="2.0">
  <channel>
    <title>Lil&#39;Log</title>
    <item>
      <title>Harness Engineering for Self-Improvement</title>
      <link>https://lilianweng.github.io/posts/2026-07-04-harness/</link>
      <pubDate>Sat, 04 Jul 2026 00:00:00 +0000</pubDate>
      <guid>https://lilianweng.github.io/posts/2026-07-04-harness/</guid>
      <description>&lt;p&gt;The concept of &lt;strong&gt;recursive self-improvement (RSI)&lt;/strong&gt; dates back to I. J. Good (1965).&lt;/p&gt;</description>
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

const BEDROCK_UG_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:atom="http://www.w3.org/2005/Atom" version="2.0">
  <channel>
    <title>User Guide Updates</title>
    <item>
      <title>New model</title>
      <link>https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-claude.html</link>
      <description>Amazon Bedrock now supports Anthropic Claude Opus 4.5. See &lt;a href="https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-claude.html"&gt;Claude model parameters&lt;/a&gt;.</description>
      <pubDate>Mon, 24 Nov 2025 19:00:00 GMT</pubDate>
      <guid isPermaLink="false">https://docs.aws.amazon.com/bedrock/latest/userguide/#New_model_2025-11-24</guid>
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

	it('parses lilianweng blog feed items', () => {
		expect(parseRssFeed(LILIANWENG_RSS)).toEqual([
			{
				externalId: 'https://lilianweng.github.io/posts/2026-07-04-harness/',
				url: 'https://lilianweng.github.io/posts/2026-07-04-harness/',
				title: 'Harness Engineering for Self-Improvement',
				summary:
					'<p>The concept of <strong>recursive self-improvement (RSI)</strong> dates back to I. J. Good (1965).</p>',
				publishedAt: new Date('Sat, 04 Jul 2026 00:00:00 +0000').toISOString(),
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

	it('parses bedrock user guide feed items', () => {
		expect(parseRssFeed(BEDROCK_UG_RSS)).toEqual([
			{
				externalId:
					'https://docs.aws.amazon.com/bedrock/latest/userguide/#New_model_2025-11-24',
				url: 'https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-claude.html',
				title: 'New model',
				summary:
					'Amazon Bedrock now supports Anthropic Claude Opus 4.5. See <a href="https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-claude.html">Claude model parameters</a>.',
				publishedAt: new Date('Mon, 24 Nov 2025 19:00:00 GMT').toISOString(),
			},
		]);
	});
});
