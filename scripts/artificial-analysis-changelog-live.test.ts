import { describe, expect, it } from 'vitest';
import { parseChangelogHtml } from '../src/sources/examples/artificial-analysis-changelog';

const CHANGELOG_URL = 'https://artificialanalysis.ai/changelog';

describe('artificial-analysis-changelog live fetch', () => {
	it('fetches and parses the real changelog page', async () => {
		const response = await fetch(CHANGELOG_URL, {
			headers: {
				'user-agent':
					'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
				accept: 'text/html,application/xhtml+xml',
			},
		});

		console.log(`\n--- artificialanalysis.ai/changelog HTTP ${response.status} ---`);
		expect(response.ok).toBe(true);

		const html = await response.text();
		console.log(`html length: ${html.length} chars`);

		const items = parseChangelogHtml(html);
		console.log(`parsed items: ${items.length}`);
		expect(items.length).toBeGreaterThan(20);

		for (const item of items.slice(0, 5)) {
			console.log(
				`  - [${item.publishedAt?.slice(0, 10) ?? 'no date'}] ${item.title} -> ${item.url}`,
			);
		}
		if (items.length > 5) {
			console.log(`  ... and ${items.length - 5} more`);
		}

		const [first] = items;
		expect(first.externalId).toBeTruthy();
		expect(first.url.startsWith('https://artificialanalysis.ai/')).toBe(true);
		expect(first.title.length).toBeGreaterThan(0);
		expect(first.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

		const ids = new Set(items.map((item) => item.externalId));
		expect(ids.size).toBe(items.length);
	});
});
