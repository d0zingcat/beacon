import { describe, expect, it } from 'vitest';
import { parseMetaBlogHtml } from './meta-ai-blog';

const HERO_CARD = `
<div class="_amcy _metaAIFeaturedBlogHero__heroContainer">
  <a class="_amcw _amcz _amd3" href="https://ai.meta.com/blog/introducing-muse-spark-meta-model-api/">
    <div class="_amd5">FEATURED</div>
    <div class="_a5n5 _al8o _a5na _acel">
      <div class="_8h4z _8h4- _a4zf">
        <img class="_amc- img" src="https://scontent-sjc6-1.xx.fbcdn.net/v/t39.2365-6/741906678_873652302465180_7764547737953411008_n.png" />
      </div>
    </div>
  </a>
  <div class="_amc_">
    <div class="_amug">Research</div>
    <div class="_amd1">
      <a class="_amcw _amd2" href="https://ai.meta.com/blog/introducing-muse-spark-meta-model-api/">Introducing Muse Spark 1.1 </a>
    </div>
    <div class="_amd4"></div>
    <div class="_amun">July 9, 2026</div>
  </div>
</div>
`;

const FEATURED_GRID_CARD = `
<div class="_amda _amdi">
  <a class="_amcw _amcz _amdg" aria-label="Read Introducing Muse Image and Muse Video" href="https://ai.meta.com/blog/introducing-muse-image-muse-video-msl/">
    <div class="_amdd">FEATURED</div>
    <div class="_a5n5 _al8o _a5na _acel">
      <div class="_8h4z _8h4- _a4zf">
        <img class="_amdb img" src="https://scontent-sjc3-1.xx.fbcdn.net/v/t39.2365-6/741068613.png" alt="" />
      </div>
    </div>
  </a>
  <div class="_amdc">
    <div class="_amdj">Research</div>
    <div class="_amde">
      <a class="_amcw _amdf" aria-label="Read Introducing Muse Image and Muse Video" href="https://ai.meta.com/blog/introducing-muse-image-muse-video-msl/">Introducing Muse Image and Muse Video</a>
    </div>
    <div class="_amdj">Jul 7, 2026</div>
  </div>
</div>
`;

const PLAIN_GRID_CARD = `
<div class="_amda _amdi">
  <a class="_amcw _amcz _amdg" aria-label="Read From Brain Waves to Words: Brain2Qwerty Offers a New Path to Communication Without Surgery" href="https://ai.meta.com/blog/brain2qwerty-brain-ai-human-communication/">
    <div class="_a5n5 _al8o _a5na _acel">
      <div class="_8h4z _8h4- _a4zf">
        <img class="_amdb img" src="https://scontent-sjc3-1.xx.fbcdn.net/v/t39.2365-6/another.png" alt="" />
      </div>
    </div>
  </a>
  <div class="_amdc">
    <div class="_amdj">Research</div>
    <div class="_amde">
      <a class="_amcw _amdf" aria-label="Read From Brain Waves to Words: Brain2Qwerty Offers a New Path to Communication Without Surgery" href="https://ai.meta.com/blog/brain2qwerty-brain-ai-human-communication/">From Brain Waves to Words: Brain2Qwerty Offers a New Path to Communication Without Surgery</a>
    </div>
    <div class="_amdj">Jun 29, 2026</div>
  </div>
</div>
`;

describe('parseMetaBlogHtml', () => {
	it('parses the hero card (long month date, no trailing FEATURED on text)', () => {
		const items = parseMetaBlogHtml(HERO_CARD);

		expect(items).toEqual([
			{
				externalId: 'introducing-muse-spark-meta-model-api',
				url: 'https://ai.meta.com/blog/introducing-muse-spark-meta-model-api/',
				title: 'Introducing Muse Spark 1.1',
				publishedAt: new Date('2026-07-09T00:00:00.000Z').toISOString(),
			},
		]);
	});

	it('parses a featured grid card (short month date)', () => {
		const items = parseMetaBlogHtml(FEATURED_GRID_CARD);

		expect(items).toEqual([
			{
				externalId: 'introducing-muse-image-muse-video-msl',
				url: 'https://ai.meta.com/blog/introducing-muse-image-muse-video-msl/',
				title: 'Introducing Muse Image and Muse Video',
				publishedAt: new Date('2026-07-07T00:00:00.000Z').toISOString(),
			},
		]);
	});

	it('parses a plain grid card (no FEATURED pill)', () => {
		const items = parseMetaBlogHtml(PLAIN_GRID_CARD);

		expect(items).toEqual([
			{
				externalId: 'brain2qwerty-brain-ai-human-communication',
				url: 'https://ai.meta.com/blog/brain2qwerty-brain-ai-human-communication/',
				title: 'From Brain Waves to Words: Brain2Qwerty Offers a New Path to Communication Without Surgery',
				publishedAt: new Date('2026-06-29T00:00:00.000Z').toISOString(),
			},
		]);
	});

	it('parses a full page mixing hero + featured + plain cards', () => {
		const items = parseMetaBlogHtml(HERO_CARD + FEATURED_GRID_CARD + PLAIN_GRID_CARD);

		expect(items).toHaveLength(3);
		expect(items.map((item) => item.externalId)).toEqual([
			'introducing-muse-spark-meta-model-api',
			'introducing-muse-image-muse-video-msl',
			'brain2qwerty-brain-ai-human-communication',
		]);
	});

	it('dedupes posts that share a slug (image + text anchor)', () => {
		// Same post rendered twice in a row (low probability but tests dedup).
		const items = parseMetaBlogHtml(FEATURED_GRID_CARD + FEATURED_GRID_CARD);

		expect(items).toHaveLength(1);
		expect(items[0].externalId).toBe('introducing-muse-image-muse-video-msl');
	});

	it('returns an empty array for pages with no matching anchors', () => {
		const items = parseMetaBlogHtml('<html><body><p>No posts here</p></body></html>');
		expect(items).toEqual([]);
	});

	it('matches relative /blog/ URLs as well as absolute ones', () => {
		const relativeCard = FEATURED_GRID_CARD.replace(
			/https:\/\/ai\.meta\.com\/blog\//g,
			'/blog/',
		);

		const items = parseMetaBlogHtml(relativeCard);

		expect(items).toHaveLength(1);
		expect(items[0].externalId).toBe('introducing-muse-image-muse-video-msl');
	});
});
