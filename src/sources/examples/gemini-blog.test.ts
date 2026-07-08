import { describe, expect, it, vi } from 'vitest';
import {
	fetchGeminiBlog,
	parseGeminiBlogDate,
	parseGeminiBlogHtml,
	resolveGeminiBlogUrl,
} from './gemini-blog';

// Quoted href — the canonical blog.google deep link with tracking params.
const QUOTED_CARD = `
<article class="card card-blog card--large_text_media card--is-link"><div class=card__inner>
<a aria-label="Learn more" class=card__overlay-link href="https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-omni/?utm_source=deepmind.google&utm_medium=referral" target=_blank></a>
<div class=card__content>
<h3 class="heading-4 card__title">Introducing Gemini Omni</h3>
<div class=meta><span class=text-caption><time datetime="May 2026">May 2026</time></span>
<span class="text-caption meta__category">Models</span></div>
</div></div></article>
`;

// Unquoted href — no tracking params.
const UNQUOTED_CARD = `
<article class="card card-blog card--small_h card--is-link"><div class=card__inner>
<a aria-label="Learn more" class=card__overlay-link href=https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-3-5/ target=_blank></a>
<div class=card__content>
<h3 class="heading-6 card__title">Gemini 3.5: frontier intelligence with action</h3>
<div class=meta><span class=text-caption><time datetime="April 2026">April 2026</time></span>
<span class="text-caption meta__category">Models</span></div>
</div></div></article>
`;

// A non-Gemini research card — still a tracked blog post.
const RESEARCH_CARD = `
<article class="card card-blog card--small_h card--is-link"><div class=card__inner>
<a aria-label="Learn more" class=card__overlay-link href=https://blog.google/innovation-and-ai/models-and-research/google-deepmind/weathernext-hurricane-melissa/ target=_blank></a>
<div class=card__content>
<h3 class="heading-6 card__title">How WeatherNext helped predict Hurricane Melissa’s landfall in Jamaica</h3>
<div class=meta><span class=text-caption><time datetime="March 2026">March 2026</time></span>
<span class="text-caption meta__category">Science</span></div>
</div></div></article>
`;

// Relative href — the path-only form that resolves against the blog origin.
const RELATIVE_CARD = `
<article class="card card-blog card--small_h card--is-link"><div class=card__inner>
<a aria-label="Learn more" class=card__overlay-link href=/blog/securing-the-future-of-ai-agents/ target=_blank></a>
<div class=card__content>
<h3 class="heading-6 card__title">Securing the future of AI agents</h3>
<div class=meta><span class=text-caption><time datetime="June 2026">June 2026</time></span>
<span class="text-caption meta__category">Responsibility & Safety</span></div>
</div></div></article>
`;

// A card missing an overlay link must be skipped.
const NO_LINK_CARD = `
<article class="card card-blog card--small_h card--is-link"><div class=card__inner>
<div class=card__content>
<h3 class="heading-6 card__title">An article without a link</h3>
<div class=meta><span class=text-caption><time datetime="February 2026">February 2026</time></span></div>
</div></div></article>
`;

describe('parseGeminiBlogDate', () => {
	it('parses "<Month> <Year>" into the first day of that month in UTC', () => {
		expect(parseGeminiBlogDate('May 2026')).toBe('2026-05-01T00:00:00.000Z');
		expect(parseGeminiBlogDate('December 2025')).toBe('2025-12-01T00:00:00.000Z');
	});

	it('returns undefined for invalid, empty, or non-conforming values', () => {
		expect(parseGeminiBlogDate(undefined)).toBeUndefined();
		expect(parseGeminiBlogDate('')).toBeUndefined();
		expect(parseGeminiBlogDate('2026-05-01')).toBeUndefined();
		expect(parseGeminiBlogDate('Smarch 2026')).toBeUndefined();
	});
});

describe('resolveGeminiBlogUrl', () => {
	it('resolves a relative path against the blog origin', () => {
		expect(resolveGeminiBlogUrl('/blog/securing-the-future-of-ai-agents/')).toBe(
			'https://deepmind.google/blog/securing-the-future-of-ai-agents/',
		);
	});

	it('leaves an absolute blog.google url untouched', () => {
		expect(
			resolveGeminiBlogUrl('https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-omni/'),
		).toBe('https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-omni/');
	});

	it('strips tracking params from an absolute url', () => {
		expect(
			resolveGeminiBlogUrl(
				'https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-omni/?utm_source=deepmind.google',
			),
		).toBe('https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-omni/');
	});
});

describe('parseGeminiBlogHtml', () => {
	it('parses a quoted-href card, stripping tracking params and reading the category', () => {
		const items = parseGeminiBlogHtml(QUOTED_CARD);
		expect(items).toEqual([
			{
				externalId: 'gemini-omni',
				url: 'https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-omni/',
				title: 'Introducing Gemini Omni',
				publishedAt: '2026-05-01T00:00:00.000Z',
				raw: { category: 'Models' },
			},
		]);
	});

	it('parses an unquoted-href card', () => {
		const items = parseGeminiBlogHtml(UNQUOTED_CARD);
		expect(items).toEqual([
			{
				externalId: 'gemini-3-5',
				url: 'https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-3-5/',
				title: 'Gemini 3.5: frontier intelligence with action',
				publishedAt: '2026-04-01T00:00:00.000Z',
				raw: { category: 'Models' },
			},
		]);
	});

	it('decodes html entities in titles', () => {
		const card = UNQUOTED_CARD.replace(
			'Gemini 3.5: frontier intelligence with action',
			'Co-Scientist: a multi-agent &amp; AI partner',
		);
		const items = parseGeminiBlogHtml(card);
		expect(items[0]?.title).toBe('Co-Scientist: a multi-agent & AI partner');
	});

	it('parses a non-Gemini deepmind research card', () => {
		const items = parseGeminiBlogHtml(RESEARCH_CARD);
		expect(items).toEqual([
			{
				externalId: 'weathernext-hurricane-melissa',
				url: 'https://blog.google/innovation-and-ai/models-and-research/google-deepmind/weathernext-hurricane-melissa/',
				title: 'How WeatherNext helped predict Hurricane Melissa’s landfall in Jamaica',
				publishedAt: '2026-03-01T00:00:00.000Z',
				raw: { category: 'Science' },
			},
		]);
	});

	it('resolves a relative overlay-link path to an absolute deep link', () => {
		const items = parseGeminiBlogHtml(RELATIVE_CARD);
		expect(items).toEqual([
			{
				externalId: 'securing-the-future-of-ai-agents',
				url: 'https://deepmind.google/blog/securing-the-future-of-ai-agents/',
				title: 'Securing the future of AI agents',
				publishedAt: '2026-06-01T00:00:00.000Z',
				raw: { category: 'Responsibility & Safety' },
			},
		]);
	});

	it('skips cards that have no overlay link', () => {
		expect(parseGeminiBlogHtml(NO_LINK_CARD)).toEqual([]);
	});

	it('dedupes cards that share a slug and keeps the first occurrence', () => {
		const dup = UNQUOTED_CARD.replace('Gemini 3.5: frontier intelligence with action', 'Duplicate title');
		const items = parseGeminiBlogHtml(UNQUOTED_CARD + dup);
		expect(items).toHaveLength(1);
		expect(items[0]?.title).toBe('Gemini 3.5: frontier intelligence with action');
	});

	it('parses the full mixed listing, including a relative-link card', () => {
		const items = parseGeminiBlogHtml(
			QUOTED_CARD + UNQUOTED_CARD + RESEARCH_CARD + RELATIVE_CARD + NO_LINK_CARD,
		);
		expect(items).toHaveLength(4);
		expect(items.map((i) => i.externalId).sort()).toEqual([
			'gemini-3-5',
			'gemini-omni',
			'securing-the-future-of-ai-agents',
			'weathernext-hurricane-melissa',
		]);
		// Every stored url is an absolute, visitable deep link.
		expect(items.every((i) => i.url.startsWith('https://'))).toBe(true);
	});
});

describe('fetchGeminiBlog', () => {
	it('fetches the deepmind blog and parses the body', async () => {
		const fetchFn = vi
			.fn()
			.mockResolvedValue(new Response(QUOTED_CARD + UNQUOTED_CARD, { status: 200 }));
		const items = await fetchGeminiBlog(fetchFn as unknown as typeof fetch);

		expect(fetchFn).toHaveBeenCalledWith('https://deepmind.google/blog/', expect.objectContaining({
			headers: expect.objectContaining({ accept: 'text/html,application/xhtml+xml' }),
		}));
		expect(items.map((i) => i.externalId)).toEqual(['gemini-omni', 'gemini-3-5']);
	});

	it('throws when the endpoint returns a non-ok status', async () => {
		const fetchFn = vi.fn().mockResolvedValue(new Response('', { status: 503 }));
		await expect(fetchGeminiBlog(fetchFn as unknown as typeof fetch)).rejects.toThrow(
			'Gemini blog fetch failed: 503',
		);
	});
});
