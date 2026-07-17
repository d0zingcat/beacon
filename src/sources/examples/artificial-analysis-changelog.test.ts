import { describe, expect, it } from 'vitest';
import { parseChangelogHtml } from './artificial-analysis-changelog';

const SAMPLE_PAGE = `
<main>
  <h4 class="text-xs font-medium pt-6 pb-2">16 Jul 2026</h4>
  <a class="flex flex-col gap-1 cursor-pointer rounded-md px-3 pt-3 pb-2 w-full max-w-xl my-2 transition-all duration-100 bg-opacity-50 bg-sky-50" href="/models/kimi-k3">
    <div class="flex flex-col">
      <span class="text-xs">New language model evaluation results available</span>
      <div class="flex items-center gap-1.5 my-1">
        <img alt="Kimi K3" src="/img/logos/kimi_small.png"/>
        <h3 class="text-sm font-normal">Kimi K3</h3>
      </div>
      <div class="prose prose-sm max-w-none text-[10px]"><p>Intelligence Index: 57</p></div>
    </div>
  </a>

  <h4 class="text-xs font-medium pt-6 pb-2">15 Jul 2026</h4>
  <a class="flex flex-col gap-1 cursor-pointer rounded-md px-3 pt-3 pb-2 w-full max-w-xl my-2 transition-all duration-100 bg-opacity-50 bg-indigo-50" href="/articles/thinking-machines-has-released-inkling-the-new-leading-u-s-open-weights-model">
    <div class="flex flex-col">
      <span class="text-xs">🔔 New article published</span>
      <div class="flex items-center gap-1.5 my-1">
        <h3 class="text-sm font-normal">Thinking Machines has released Inkling, the new leading U.S. open weights model</h3>
      </div>
      <div class="prose prose-sm max-w-none text-[10px]">
        <p>Thinking Machines has released Inkling, the new leading U.S. open weights model, debuting at 41 on the Artificial Analysis Intelligence Index</p>
      </div>
    </div>
  </a>
  <a class="flex flex-col gap-1 cursor-pointer rounded-md px-3 pt-3 pb-2 w-full max-w-xl my-2 transition-all duration-100 bg-opacity-50 bg-sky-50" href="/models/inkling">
    <div class="flex flex-col">
      <span class="text-xs">New language model evaluation results available</span>
      <h3 class="text-sm font-normal">Inkling (xhigh)</h3>
      <div class="prose prose-sm max-w-none text-[10px]"><p>Intelligence Index: 41</p></div>
    </div>
  </a>

  <h4 class="text-xs font-medium pt-6 pb-2">02 May 2026</h4>
  <a class="flex flex-col gap-1 cursor-pointer rounded-md px-3 pt-3 pb-2 w-full max-w-xl my-2 transition-all duration-100 bg-opacity-50 bg-emerald-50" href="/image/leaderboard/text-to-image">
    <div class="flex flex-col">
      <span class="text-xs">New model in Text to Image Leaderboard</span>
      <h3 class="text-sm font-normal">Krea 2 Large</h3>
      <div class="prose prose-sm max-w-none text-[10px]"><p>Text to Image Elo: 1184</p></div>
    </div>
  </a>
  <a class="flex flex-col gap-1 cursor-pointer rounded-md px-3 pt-3 pb-2 w-full max-w-xl my-2 transition-all duration-100 bg-opacity-50 bg-emerald-50" href="/image/leaderboard/text-to-image">
    <div class="flex flex-col">
      <span class="text-xs">New model in Text to Image Leaderboard</span>
      <h3 class="text-sm font-normal">Flux Another Model</h3>
      <div class="prose prose-sm max-w-none text-[10px]"><p>Text to Image Elo: 1100</p></div>
    </div>
  </a>
  <a class="flex flex-col gap-1 cursor-pointer rounded-md px-3 pt-3 pb-2 w-full max-w-xl my-2 transition-all duration-100 bg-opacity-50 bg-violet-50" href="/#price">
    <div class="flex flex-col">
      <span class="text-xs">🚀 New website feature</span>
      <h3 class="text-sm font-normal">Cache pricing now available in language model pricing</h3>
      <div class="prose prose-sm max-w-none text-[10px]">
        <p>Compare cached input token prices across models and providers</p>
      </div>
    </div>
  </a>
</main>
`;

describe('parseChangelogHtml', () => {
	it('parses dated timeline cards with labels and summaries', () => {
		const items = parseChangelogHtml(SAMPLE_PAGE);

		expect(items[0]).toEqual({
			externalId: '2026-07-16:/models/kimi-k3:Kimi K3',
			url: 'https://artificialanalysis.ai/models/kimi-k3',
			title: 'Kimi K3',
			summary: 'New language model evaluation results available — Intelligence Index: 57',
			publishedAt: '2026-07-16T00:00:00.000Z',
		});

		expect(items[1]).toEqual({
			externalId:
				'2026-07-15:/articles/thinking-machines-has-released-inkling-the-new-leading-u-s-open-weights-model:Thinking Machines has released Inkling, the new leading U.S. open weights model',
			url: 'https://artificialanalysis.ai/articles/thinking-machines-has-released-inkling-the-new-leading-u-s-open-weights-model',
			title: 'Thinking Machines has released Inkling, the new leading U.S. open weights model',
			summary:
				'New article published — Thinking Machines has released Inkling, the new leading U.S. open weights model, debuting at 41 on the Artificial Analysis Intelligence Index',
			publishedAt: '2026-07-15T00:00:00.000Z',
		});
	});

	it('keeps shared leaderboard hrefs distinct via title', () => {
		const items = parseChangelogHtml(SAMPLE_PAGE);
		const leaderboard = items.filter((item) => item.url.includes('/image/leaderboard/text-to-image'));

		expect(leaderboard).toHaveLength(2);
		expect(leaderboard.map((item) => item.externalId)).toEqual([
			'2026-05-02:/image/leaderboard/text-to-image:Krea 2 Large',
			'2026-05-02:/image/leaderboard/text-to-image:Flux Another Model',
		]);
	});

	it('resolves hash-only hrefs against the site origin', () => {
		const items = parseChangelogHtml(SAMPLE_PAGE);
		const feature = items.find((item) => item.title.startsWith('Cache pricing'));

		expect(feature).toMatchObject({
			externalId: '2026-05-02:/#price:Cache pricing now available in language model pricing',
			url: 'https://artificialanalysis.ai/#price',
			summary:
				'New website feature — Compare cached input token prices across models and providers',
			publishedAt: '2026-05-02T00:00:00.000Z',
		});
	});

	it('dedupes identical date/path/title triples', () => {
		const duplicate = `
<h4 class="text-xs font-medium pt-6 pb-2">16 Jul 2026</h4>
<a class="flex flex-col gap-1" href="/models/kimi-k3"><span class="text-xs">New language model evaluation results available</span><h3>Kimi K3</h3></a>
<a class="flex flex-col gap-1" href="/models/kimi-k3"><span class="text-xs">New language model evaluation results available</span><h3>Kimi K3</h3></a>
`;
		const items = parseChangelogHtml(duplicate);

		expect(items).toHaveLength(1);
		expect(items[0].externalId).toBe('2026-07-16:/models/kimi-k3:Kimi K3');
	});

	it('skips cards without a title', () => {
		const html = `
<h4 class="text-xs font-medium pt-6 pb-2">16 Jul 2026</h4>
<a class="flex flex-col gap-1" href="/models/missing"><span class="text-xs">New language model evaluation results available</span></a>
`;
		expect(parseChangelogHtml(html)).toEqual([]);
	});

	it('parses the full sample page in timeline order', () => {
		const items = parseChangelogHtml(SAMPLE_PAGE);

		expect(items).toHaveLength(6);
		expect(items.map((item) => item.title)).toEqual([
			'Kimi K3',
			'Thinking Machines has released Inkling, the new leading U.S. open weights model',
			'Inkling (xhigh)',
			'Krea 2 Large',
			'Flux Another Model',
			'Cache pricing now available in language model pricing',
		]);
	});
});
