import { describe, expect, it, vi } from 'vitest';
import {
	fetchMicrosoftAiNews,
	parseMicrosoftAiDate,
	parseMicrosoftAiNewsHtml,
	resolveMicrosoftAiNewsUrl,
} from './microsoft-ai-news';

const FEATURED_CARD = `
<article data-article-featured class="min-w-0">
  <a href="https://microsoft.ai/news/microsoft-ignite-2026/" class="group block">
    <h2 class="m-0 font-serif">
      Seven new world class models at scalable price-performance    </h2>
  </a>
  <div>
    <time datetime="2026-11-17T13:16:05-05:00">November 17, 2026</time>
  </div>
</article>
`;

const COMPACT_CARD = `
<article data-article-compact class="min-w-0">
  <a href="https://microsoft.ai/news/introducing-mai-code-2-and-mai-code-2-flash/" class="group block">
    <h2>MAI Code 2 &amp; Code 2 Flash: Everyday coding at scalable prices</h2>
  </a>
  <time datetime="2026-11-17T13:15:16-05:00">November 17, 2026</time>
</article>
`;

const RELATIVE_CARD = `
<article data-article-list class="min-w-0">
  <a href="/news/introducing-mai-image-2-7/?utm_source=homepage">
    <h3>MAI Image 2.7: Frontier&#8217;s best quality</h3>
  </a>
  <time datetime="2026-09-04T12:02:05-04:00">September 4, 2026</time>
</article>
`;

const MODEL_CARD_IGNORED = `
<article class="min-w-0">
  <a href="https://microsoft.ai/models/mai-code-2/">
    <h3>MAI Code 2</h3>
  </a>
</article>
`;

describe('parseMicrosoftAiDate', () => {
	it('parses ISO-8601 datetime with timezone offset to UTC ISO string', () => {
		expect(parseMicrosoftAiDate('2026-11-17T13:16:05-05:00')).toBe('2026-11-17T18:16:05.000Z');
		expect(parseMicrosoftAiDate('2026-09-04T12:02:05-04:00')).toBe('2026-09-04T16:02:05.000Z');
	});

	it('returns undefined for missing or invalid dates', () => {
		expect(parseMicrosoftAiDate(undefined)).toBeUndefined();
		expect(parseMicrosoftAiDate('')).toBeUndefined();
		expect(parseMicrosoftAiDate('not-a-date')).toBeUndefined();
	});
});

describe('resolveMicrosoftAiNewsUrl', () => {
	it('resolves relative /news/ paths and strips query params', () => {
		expect(resolveMicrosoftAiNewsUrl('/news/introducing-mai-image-2-7/?utm_source=homepage')).toBe(
			'https://microsoft.ai/news/introducing-mai-image-2-7/',
		);
	});

	it('preserves absolute URLs without query params', () => {
		expect(resolveMicrosoftAiNewsUrl('https://microsoft.ai/news/microsoft-ignite-2026/')).toBe(
			'https://microsoft.ai/news/microsoft-ignite-2026/',
		);
	});
});

describe('parseMicrosoftAiNewsHtml', () => {
	it('parses featured, compact, and relative news articles', () => {
		const items = parseMicrosoftAiNewsHtml(FEATURED_CARD + COMPACT_CARD + RELATIVE_CARD);
		expect(items).toEqual([
			{
				externalId: 'microsoft-ignite-2026',
				url: 'https://microsoft.ai/news/microsoft-ignite-2026/',
				title: 'Seven new world class models at scalable price-performance',
				publishedAt: '2026-11-17T18:16:05.000Z',
			},
			{
				externalId: 'introducing-mai-code-2-and-mai-code-2-flash',
				url: 'https://microsoft.ai/news/introducing-mai-code-2-and-mai-code-2-flash/',
				title: 'MAI Code 2 & Code 2 Flash: Everyday coding at scalable prices',
				publishedAt: '2026-11-17T18:15:16.000Z',
			},
			{
				externalId: 'introducing-mai-image-2-7',
				url: 'https://microsoft.ai/news/introducing-mai-image-2-7/',
				title: 'MAI Image 2.7: Frontier\u2019s best quality',
				publishedAt: '2026-09-04T16:02:05.000Z',
			},
		]);
	});

	it('ignores non-news articles and deduplicates repeated slugs', () => {
		const items = parseMicrosoftAiNewsHtml(MODEL_CARD_IGNORED + COMPACT_CARD + COMPACT_CARD);
		expect(items).toHaveLength(1);
		expect(items[0]?.externalId).toBe('introducing-mai-code-2-and-mai-code-2-flash');
	});
});

describe('fetchMicrosoftAiNews', () => {
	it('fetches microsoft.ai/news and parses the response', async () => {
		const fetchFn = vi.fn().mockResolvedValue(new Response(FEATURED_CARD, { status: 200 }));
		const items = await fetchMicrosoftAiNews(fetchFn as unknown as typeof fetch);
		expect(fetchFn).toHaveBeenCalledWith(
			'https://microsoft.ai/news',
			expect.objectContaining({
				headers: expect.objectContaining({ accept: 'text/html,application/xhtml+xml' }),
			}),
		);
		expect(items.map((item) => item.externalId)).toEqual(['microsoft-ignite-2026']);
	});

	it('throws on non-2xx responses', async () => {
		const fetchFn = vi.fn().mockResolvedValue(new Response('oops', { status: 502, statusText: 'Bad Gateway' }));
		await expect(fetchMicrosoftAiNews(fetchFn as unknown as typeof fetch)).rejects.toThrow(
			'Microsoft AI News fetch failed: 502',
		);
	});
});
