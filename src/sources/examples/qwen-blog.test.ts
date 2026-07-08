import { describe, expect, it, vi } from 'vitest';
import {
	buildQwenBlogUrl,
	fetchQwenBlogList,
	parseQwenBlogList,
	parseQwenDate,
	pickQwenSummary,
	stripQwenMarkdown,
} from './qwen-blog';

const SAMPLE_LIST = JSON.stringify([
	{
		id: 'qwen3-tts-vc-voicedesign',
		title: 'Qwen3-TTS Steps Up: Voice Cloning and Voice Design!',
		date: '2025-12-22T16:00:45.000Z',
		description: undefined,
		introduction:
			'**Qwen3-TTS** family has launched two new models: the voice design model Qwen3-TTS-VD-Flash (accessible via the [Qwen API](https://www.alibabacloud.com/help/en/)).',
		tags: ['Release'],
	},
	{
		id: 'qwen-image-edit-2511',
		title: 'Qwen-Image-Edit-2511: Improve Consistency',
		date: '2025-12-23T05:08:30.000Z',
		description: 'We are excited to introduce Qwen-Image-Edit-2511, an enhanced version over Qwen-Image-Edit.',
		introduction: 'Longer introduction body that should not be used when description is present.',
		tags: ['Open-Source'],
	},
	{
		id: 'chinese-clip',
		title: 'Chinese CLIP: Contrastive Vision-Language Pretraining in Chinese',
		date: '2022-12-24T06:54:19.000Z',
		description: 'A language-specific CLIP for cross-modal retrieval.',
		introduction: '![cover](https://example.com/x.png) However, we find that there is a necessity **for** a `language-specific` CLIP.',
		tags: ['Research'],
	},
]);

describe('buildQwenBlogUrl', () => {
	it('builds the qwen.ai blog deep link from an article id', () => {
		expect(buildQwenBlogUrl('qwen3-tts-vc-voicedesign')).toBe(
			'https://qwen.ai/blog?id=qwen3-tts-vc-voicedesign',
		);
	});

	it('encodes special characters in the id', () => {
		expect(buildQwenBlogUrl('a b/c')).toBe('https://qwen.ai/blog?id=a%20b%2Fc');
	});
});

describe('stripQwenMarkdown', () => {
	it('removes bold, italic, code, links and images while keeping text', () => {
		expect(
			stripQwenMarkdown(
				'![alt](https://x/y.png) **bold** *italic* `code` [Qwen API](https://x)\n# heading\n> quote',
			),
		).toBe('alt bold italic code Qwen API heading quote');
	});

	it('collapses whitespace', () => {
		expect(stripQwenMarkdown('  hello\n\n  world  ')).toBe('hello world');
	});
});

describe('pickQwenSummary', () => {
	it('prefers the description field and strips markdown', () => {
		expect(
			pickQwenSummary({
				id: 'x',
				title: 'x',
				description: 'Plain **summary** here.',
				introduction: 'ignored',
			}),
		).toBe('Plain summary here.');
	});

	it('falls back to a truncated introduction when description is missing', () => {
		const long = `**Qwen3-TTS** launched ${'a '.repeat(200)}`.trim();
		const summary = pickQwenSummary({ id: 'x', title: 'x', introduction: long });
		expect(summary?.startsWith('Qwen3-TTS launched')).toBe(true);
		expect(summary?.endsWith('...')).toBe(true);
		expect(summary?.length).toBeLessThanOrEqual(280);
	});

	it('returns undefined when neither description nor introduction exist', () => {
		expect(pickQwenSummary({ id: 'x', title: 'x' })).toBeUndefined();
	});
});

describe('parseQwenDate', () => {
	it('parses ISO dates into ISO strings', () => {
		expect(parseQwenDate('2025-12-22T16:00:45.000Z')).toBe('2025-12-22T16:00:45.000Z');
	});

	it('returns undefined for invalid or missing dates', () => {
		expect(parseQwenDate(undefined)).toBeUndefined();
		expect(parseQwenDate('not-a-date')).toBeUndefined();
	});
});

describe('parseQwenBlogList', () => {
	it('maps articles to raw items with url, summary and publishedAt', () => {
		const items = parseQwenBlogList(SAMPLE_LIST);
		expect(items).toEqual([
			{
				externalId: 'qwen3-tts-vc-voicedesign',
				url: 'https://qwen.ai/blog?id=qwen3-tts-vc-voicedesign',
				title: 'Qwen3-TTS Steps Up: Voice Cloning and Voice Design!',
				summary:
					'Qwen3-TTS family has launched two new models: the voice design model Qwen3-TTS-VD-Flash (accessible via the Qwen API).',
				publishedAt: '2025-12-22T16:00:45.000Z',
			},
			{
				externalId: 'qwen-image-edit-2511',
				url: 'https://qwen.ai/blog?id=qwen-image-edit-2511',
				title: 'Qwen-Image-Edit-2511: Improve Consistency',
				summary:
					'We are excited to introduce Qwen-Image-Edit-2511, an enhanced version over Qwen-Image-Edit.',
				publishedAt: '2025-12-23T05:08:30.000Z',
			},
			{
				externalId: 'chinese-clip',
				url: 'https://qwen.ai/blog?id=chinese-clip',
				title: 'Chinese CLIP: Contrastive Vision-Language Pretraining in Chinese',
				summary: 'A language-specific CLIP for cross-modal retrieval.',
				publishedAt: '2022-12-24T06:54:19.000Z',
			},
		]);
	});

	it('dedupes articles that share an id', () => {
		const json = JSON.stringify([
			{ id: 'dup', title: 'First', date: '2025-01-01T00:00:00.000Z', description: 'a' },
			{ id: 'dup', title: 'Second', date: '2025-01-02T00:00:00.000Z', description: 'b' },
		]);
		const items = parseQwenBlogList(json);
		expect(items).toHaveLength(1);
		expect(items[0]?.title).toBe('First');
	});

	it('skips entries missing id or title', () => {
		const json = JSON.stringify([
			{ id: '', title: 'No id' },
			{ id: 'no-title', title: '' },
			{ id: 'good', title: 'Good', date: '2025-03-01T00:00:00.000Z' },
		]);
		const items = parseQwenBlogList(json);
		expect(items).toEqual([
			{
				externalId: 'good',
				url: 'https://qwen.ai/blog?id=good',
				title: 'Good',
				summary: undefined,
				publishedAt: '2025-03-01T00:00:00.000Z',
			},
		]);
	});

	it('returns an empty list for non-array or invalid JSON payloads', () => {
		expect(parseQwenBlogList('{"data":[]}')).toEqual([]);
		expect(parseQwenBlogList('not json')).toEqual([]);
		expect(parseQwenBlogList('[]')).toEqual([]);
	});
});

describe('fetchQwenBlogList', () => {
	it('fetches the page-config endpoint and parses the body', async () => {
		const fetchFn = vi
			.fn()
			.mockResolvedValue(new Response(SAMPLE_LIST, { status: 200, headers: { 'content-type': 'application/json' } }));
		const items = await fetchQwenBlogList(fetchFn as unknown as typeof fetch);

		expect(fetchFn).toHaveBeenCalledWith(
			'https://qwen.ai/api/page_config?code=research.research-list',
			expect.objectContaining({
				headers: expect.objectContaining({ accept: 'application/json' }),
			}),
		);
		expect(items.map((i) => i.externalId)).toEqual([
			'qwen3-tts-vc-voicedesign',
			'qwen-image-edit-2511',
			'chinese-clip',
		]);
	});

	it('throws when the endpoint returns a non-ok status', async () => {
		const fetchFn = vi.fn().mockResolvedValue(new Response('', { status: 503 }));
		await expect(fetchQwenBlogList(fetchFn as unknown as typeof fetch)).rejects.toThrow(
			'Qwen blog fetch failed: 503',
		);
	});
});
