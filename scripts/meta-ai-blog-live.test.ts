import { describe, expect, it } from 'vitest';
import { parseMetaBlogHtml } from '../src/sources/examples/meta-ai-blog';

const META_BLOG_URL = 'https://ai.meta.com/blog/';

describe('meta-ai-blog live fetch', () => {
	it('fetches and parses the real ai.meta.com/blog page', async () => {
		const response = await fetch(META_BLOG_URL, {
			headers: {
				'user-agent':
					'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
				accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
				'accept-language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
				'sec-fetch-dest': 'document',
				'sec-fetch-mode': 'navigate',
				'sec-fetch-site': 'none',
				'sec-fetch-user': '?1',
			},
		});

		console.log(`\n--- ai.meta.com/blog HTTP ${response.status} ---`);
		expect(response.ok).toBe(true);

		const html = await response.text();
		console.log(`html length: ${html.length} chars`);

		const items = parseMetaBlogHtml(html);
		console.log(`parsed items: ${items.length}`);
		expect(items.length).toBeGreaterThan(0);

		for (const item of items.slice(0, 8)) {
			console.log(
				`  - [${item.publishedAt?.slice(0, 10) ?? 'no date'}] ${item.title} -> ${item.url}`,
			);
		}
		if (items.length > 8) {
			console.log(`  ... and ${items.length - 8} more`);
		}

		// Sanity checks on the parsed shape.
		const [first] = items;
		expect(first.externalId).toBeTruthy();
		expect(first.url.startsWith('https://ai.meta.com/blog/')).toBe(true);
		expect(first.title.length).toBeGreaterThan(0);

		// Slugs must be unique.
		const slugs = new Set(items.map((item) => item.externalId));
		expect(slugs.size).toBe(items.length);

		// The newest post should be the Muse Spark item the user mentioned.
		expect(items[0].title).toContain('Muse Spark');
	});
});
