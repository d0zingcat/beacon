import { describe, expect, it } from 'vitest';
import { parseCursorChangelogHtml } from './cursor-changelog';

const SAMPLE_HTML = `
<article>
  <header>
    <h1>
      <a href="/changelog/team-marketplace-updates">MCPs and Organizations in Team Marketplaces</a>
    </h1>
  </header>
  <div class="prose prose--block">
    <p>We&#x27;ve expanded team marketplaces to support Team MCPs and organization groups.</p>
  </div>
  <time dateTime="2026-06-30T00:00:00.000Z">Jun 30, 2026</time>
</article>
`;

describe('parseCursorChangelogHtml', () => {
	it('parses changelog articles from HTML', () => {
		const items = parseCursorChangelogHtml(SAMPLE_HTML);

		expect(items).toEqual([
			{
				externalId: 'team-marketplace-updates',
				url: 'https://cursor.com/changelog/team-marketplace-updates',
				title: 'MCPs and Organizations in Team Marketplaces',
				summary: "We've expanded team marketplaces to support Team MCPs and organization groups.",
				publishedAt: new Date('2026-06-30T00:00:00.000Z').toISOString(),
			},
		]);
	});

	it('dedupes responsive duplicate articles on the same page', () => {
		const duplicateHtml = SAMPLE_HTML + SAMPLE_HTML;
		const items = parseCursorChangelogHtml(duplicateHtml);

		expect(items).toHaveLength(1);
		expect(items[0]?.externalId).toBe('team-marketplace-updates');
	});
});
