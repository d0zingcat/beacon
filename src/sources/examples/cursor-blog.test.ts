import { describe, expect, it } from 'vitest';
import { parseCursorBlogHtml } from './cursor-blog';

const DIRECTORY_ROW = `
<a class="blog-directory__row block px-g1.75 pb-v8/12 hover:bg-theme-card-02-hex pt-v7/12" href="/blog/notion">
  <article class="grid">
    <div>
      <time dateTime="2026-06-25T12:00:00.000Z">Jun 25, 2026</time>
      <span>·</span>
      <span class="capitalize">product</span>
    </div>
    <div>
      <p class="type-base text-theme-text text-pretty">How Notion used the Cursor SDK to embed coding agents</p>
    </div>
  </article>
</a>
`;

const FEATURED_CARD = `
<article class="h-full">
  <a class="card card--media card--feature flex h-full flex-col p-0" href="/blog/ios-mobile-app">
    <header>
      <img alt="Build from anywhere with Cursor for iOS" />
    </header>
    <div class="card--media-content">
      <time dateTime="2026-06-29T12:00:00.000Z">Jun 29, 2026</time>
      <p class="type-md-lg text-theme-text mt-v2/12 text-balance">Build from anywhere with Cursor for iOS</p>
      <p class="type-base text-theme-text-sec mt-v4/12 text-pretty">Cursor is available as a native iOS app on your phone, now in public beta.</p>
    </div>
  </a>
</article>
`;

const CUSTOMER_STORY_CARD = `
<article class="h-full">
  <a class="card card--feature flex h-full grow-1 items-stretch pb-g2 flex-col gap-0" href="/blog/coinbase">
    <div>
      <p class="type-base text-theme-text text-pretty">Coinbase reduces time from idea to production by 90% with Cursor</p>
      <time dateTime="2026-06-23T12:00:00.000Z">Jun 23, 2026</time>
    </div>
  </a>
</article>
`;

describe('parseCursorBlogHtml', () => {
	it('parses blog directory rows', () => {
		const items = parseCursorBlogHtml(DIRECTORY_ROW);

		expect(items).toEqual([
			{
				externalId: 'notion',
				url: 'https://cursor.com/blog/notion',
				title: 'How Notion used the Cursor SDK to embed coding agents',
				summary: undefined,
				publishedAt: new Date('2026-06-25T12:00:00.000Z').toISOString(),
			},
		]);
	});

	it('parses featured cards with summary', () => {
		const items = parseCursorBlogHtml(FEATURED_CARD);

		expect(items).toEqual([
			{
				externalId: 'ios-mobile-app',
				url: 'https://cursor.com/blog/ios-mobile-app',
				title: 'Build from anywhere with Cursor for iOS',
				summary: 'Cursor is available as a native iOS app on your phone, now in public beta.',
				publishedAt: new Date('2026-06-29T12:00:00.000Z').toISOString(),
			},
		]);
	});

	it('merges directory rows with featured summaries and includes customer stories', () => {
		const html = FEATURED_CARD + DIRECTORY_ROW + CUSTOMER_STORY_CARD;
		const items = parseCursorBlogHtml(html);

		expect(items).toHaveLength(3);
		expect(items.find((item) => item.externalId === 'ios-mobile-app')?.summary).toBe(
			'Cursor is available as a native iOS app on your phone, now in public beta.',
		);
		expect(items.find((item) => item.externalId === 'notion')?.title).toBe(
			'How Notion used the Cursor SDK to embed coding agents',
		);
		expect(items.find((item) => item.externalId === 'coinbase')).toMatchObject({
			title: 'Coinbase reduces time from idea to production by 90% with Cursor',
			url: 'https://cursor.com/blog/coinbase',
		});
	});

	it('dedupes responsive duplicate directory rows', () => {
		const items = parseCursorBlogHtml(DIRECTORY_ROW + DIRECTORY_ROW);

		expect(items).toHaveLength(1);
	});
});
