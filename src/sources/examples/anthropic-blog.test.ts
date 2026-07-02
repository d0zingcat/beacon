import { describe, expect, it } from 'vitest';
import { parseAnthropicNewsHtml } from './anthropic-blog';

const PUBLICATION_LIST_ITEM = `
<a href="/news/claude-sonnet-5" class="PublicationList-module-scss-module__KxYrHG__listItem">
  <div class="PublicationList-module-scss-module__KxYrHG__meta">
    <time class="PublicationList-module-scss-module__KxYrHG__date body-3">Jun 30, 2026</time>
    <span class="PublicationList-module-scss-module__KxYrHG__subject body-3">Product</span>
  </div>
  <span class="PublicationList-module-scss-module__KxYrHG__title body-3">Introducing Claude Sonnet 5</span>
</a>
`;

const FEATURED_ITEM = `
<a href="/news/redeploying-fable-5" class="FeaturedGrid-module-scss-module__W1FydW__content">
  <h2 class="headline-4 FeaturedGrid-module-scss-module__W1FydW__featuredTitle">Redeploying Fable 5</h2>
  <time class="FeaturedGrid-module-scss-module__W1FydW__date caption bold">Jun 30, 2026</time>
  <p class="body-3 serif FeaturedGrid-module-scss-module__W1FydW__body">Fable 5 returns globally July 1.</p>
</a>
`;

const SIDE_ITEM = `
<a href="/policy-on-the-ai-exponential" class="FeaturedGrid-module-scss-module__W1FydW__sideLink FeaturedGrid-module-scss-module__W1FydW__gridItem">
  <time class="FeaturedGrid-module-scss-module__W1FydW__date caption bold">Jun 10, 2026</time>
  <h4 class="headline-6 FeaturedGrid-module-scss-module__W1FydW__title">Policy on the AI Exponential</h4>
  <p class="body-3 serif FeaturedGrid-module-scss-module__W1FydW__body">AI is advancing at exponential speed.</p>
</a>
`;

describe('parseAnthropicNewsHtml', () => {
	it('parses publication list items', () => {
		const items = parseAnthropicNewsHtml(PUBLICATION_LIST_ITEM);

		expect(items).toEqual([
			{
				externalId: 'claude-sonnet-5',
				url: 'https://www.anthropic.com/news/claude-sonnet-5',
				title: 'Introducing Claude Sonnet 5',
				summary: undefined,
				publishedAt: new Date('Jun 30, 2026').toISOString(),
			},
		]);
	});

	it('parses featured items with summary', () => {
		const items = parseAnthropicNewsHtml(FEATURED_ITEM);

		expect(items).toEqual([
			{
				externalId: 'redeploying-fable-5',
				url: 'https://www.anthropic.com/news/redeploying-fable-5',
				title: 'Redeploying Fable 5',
				summary: 'Fable 5 returns globally July 1.',
				publishedAt: new Date('Jun 30, 2026').toISOString(),
			},
		]);
	});

	it('parses side items outside /news paths', () => {
		const items = parseAnthropicNewsHtml(SIDE_ITEM);

		expect(items).toEqual([
			{
				externalId: 'policy-on-the-ai-exponential',
				url: 'https://www.anthropic.com/policy-on-the-ai-exponential',
				title: 'Policy on the AI Exponential',
				summary: 'AI is advancing at exponential speed.',
				publishedAt: new Date('Jun 10, 2026').toISOString(),
			},
		]);
	});

	it('merges list rows with featured summaries', () => {
		const html = PUBLICATION_LIST_ITEM + FEATURED_ITEM;
		const items = parseAnthropicNewsHtml(html);

		expect(items).toHaveLength(2);
		expect(items.find((item) => item.externalId === 'redeploying-fable-5')?.summary).toBe(
			'Fable 5 returns globally July 1.',
		);
	});
});
