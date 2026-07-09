import { describe, expect, it } from 'vitest';
import { parseNewsHtml } from './xai-news';

const FEATURED_HERO_CARD = `
<a class="group/card block lg:grid lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] lg:items-center lg:gap-12" href="/news/grok-4-5">
  <div class="border-primary/[0.06] bg-card relative overflow-hidden border rounded-xl">
    <div class="relative w-full overflow-hidden bg-transparent" style="aspect-ratio:1200 / 630">
      <div aria-hidden="true" class="absolute inset-0 overflow-hidden bg-black" data-paper-shader=""></div>
    </div>
  </div>
  <div class="lg:order-1">
    <div class="text-primary/40 text-[11px]">Jul 8, 2026</div>
    <h2 class="text-primary/80 mt-1 text-sm font-medium">Introducing Grok 4.5</h2>
    <div class="text-primary/25 text-xs">Jul 8, 2026</div>
    <h1 class="font-display mt-5 text-3xl font-medium leading-[1.1]">Introducing Grok 4.5</h1>
    <p class="text-primary/45 mt-4 max-w-md text-sm leading-relaxed">Grok 4.5 is xAI's smartest model built for coding, agentic tasks, and knowledge work.</p>
  </div>
</a>
`;

const FEATURED_GRID_CARD = `
<a class="group/card block" href="/news/new-flagship-voices">
  <div class="border-primary/[0.06] bg-card relative overflow-hidden border rounded-xl">
    <div class="relative w-full overflow-hidden bg-transparent" style="aspect-ratio:1200 / 630">
      <img alt="21 New Flagship Grok Voices" loading="lazy" decoding="async" data-nimg="fill" class="object-cover" srcset="/_next/image?url=%2Fimages%2Fnews%2Fnew-flagship-voices.webp&amp;w=256&amp;q=75 256w" />
    </div>
  </div>
  <div class="p-5">
    <div class="text-primary/40 text-[11px]">Jul 6, 2026</div>
    <h3 class="text-primary/80 mt-1 text-sm font-medium">21 New Flagship Grok Voices</h3>
  </div>
</a>
`;

const LIST_CARD = `
<a class="group/card hover:bg-primary/[0.02] -mx-3 flex flex-col gap-4 px-3 py-5 transition-colors duration-300 sm:flex-row sm:items-center sm:justify-between sm:gap-8" href="/news/grok-databricks">
  <div class="flex-1">
    <h3 class="text-primary/80 text-sm font-medium leading-snug tracking-tight sm:text-base">Grok on Databricks</h3>
    <p class="text-primary/40 mt-1 line-clamp-1 text-sm">Grok models are now available on Databricks Agent Bricks.</p>
  </div>
  <div class="text-primary/40 shrink-0 text-xs">Jun 18, 2026</div>
</a>
`;

describe('parseNewsHtml', () => {
	it('parses the featured hero card (heading title, no image)', () => {
		const items = parseNewsHtml(FEATURED_HERO_CARD);

		expect(items).toEqual([
			{
				externalId: 'grok-4-5',
				url: 'https://x.ai/news/grok-4-5',
				title: 'Introducing Grok 4.5',
				summary: "Grok 4.5 is xAI's smartest model built for coding, agentic tasks, and knowledge work.",
				publishedAt: new Date('2026-07-08T00:00:00.000Z').toISOString(),
			},
		]);
	});

	it('parses a featured grid card (image alt title)', () => {
		const items = parseNewsHtml(FEATURED_GRID_CARD);

		expect(items).toEqual([
			{
				externalId: 'new-flagship-voices',
				url: 'https://x.ai/news/new-flagship-voices',
				title: '21 New Flagship Grok Voices',
				summary: undefined,
				publishedAt: new Date('2026-07-06T00:00:00.000Z').toISOString(),
			},
		]);
	});

	it('parses a list card (heading + summary + date)', () => {
		const items = parseNewsHtml(LIST_CARD);

		expect(items).toEqual([
			{
				externalId: 'grok-databricks',
				url: 'https://x.ai/news/grok-databricks',
				title: 'Grok on Databricks',
				summary: 'Grok models are now available on Databricks Agent Bricks.',
				publishedAt: new Date('2026-06-18T00:00:00.000Z').toISOString(),
			},
		]);
	});

	it('parses a full page mixing all card types', () => {
		const items = parseNewsHtml(FEATURED_HERO_CARD + FEATURED_GRID_CARD + LIST_CARD);

		expect(items).toHaveLength(3);
		expect(items.map((item) => item.externalId)).toEqual([
			'grok-4-5',
			'new-flagship-voices',
			'grok-databricks',
		]);
	});

	it('dedupes cards that share a slug', () => {
		const items = parseNewsHtml(FEATURED_GRID_CARD + FEATURED_GRID_CARD);

		expect(items).toHaveLength(1);
		expect(items[0].externalId).toBe('new-flagship-voices');
	});

	it('ignores cards without a title', () => {
		const cardWithoutTitle = `
<a class="group/card block" href="/news/some-post">
  <div class="p-5">
    <div class="text-primary/40 text-[11px]">Jul 6, 2026</div>
  </div>
</a>
`;
		const items = parseNewsHtml(cardWithoutTitle);

		expect(items).toHaveLength(0);
	});
});
