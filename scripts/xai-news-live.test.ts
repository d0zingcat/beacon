import { describe, expect, it } from 'vitest';
import { parseNewsHtml } from '../src/sources/examples/xai-news';

const XAI_BLOG_URL = 'https://x.ai/blog';

describe('xai-news live fetch', () => {
	it('fetches and parses the real x.ai/blog page', async () => {
		const response = await fetch(XAI_BLOG_URL, {
			headers: {
				'user-agent':
					'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
				accept: 'text/html,application/xhtml+xml',
			},
		});

		console.log(`\n--- x.ai/blog HTTP ${response.status} ---`);
		expect(response.ok).toBe(true);

		const html = await response.text();
		console.log(`html length: ${html.length} chars`);

		const items = parseNewsHtml(html);
		console.log(`parsed items: ${items.length}`);
		expect(items.length).toBeGreaterThan(0);

		for (const item of items.slice(0, 5)) {
			console.log(
				`  - [${item.publishedAt?.slice(0, 10) ?? 'no date'}] ${item.title} -> ${item.url}`,
			);
		}
		if (items.length > 5) {
			console.log(`  ... and ${items.length - 5} more`);
		}

		// Sanity checks on the parsed shape.
		const [first] = items;
		expect(first.externalId).toBeTruthy();
		expect(first.url.startsWith('https://x.ai/news/')).toBe(true);
		expect(first.title.length).toBeGreaterThan(0);

		// Slugs must be unique.
		const slugs = new Set(items.map((item) => item.externalId));
		expect(slugs.size).toBe(items.length);
	});
});
