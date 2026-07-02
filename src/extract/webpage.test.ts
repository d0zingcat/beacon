import { describe, expect, it, vi } from 'vitest';
import { createWebpageExtractor } from './webpage';
import type { RawItem } from '../sources/types';

const SAMPLE_HTML = '<html><body><h1>Title</h1></body></html>';

describe('createWebpageExtractor', () => {
	it('fetches page and runs parser', async () => {
		const parse = vi.fn(
			(_html: string, _ctx: { env: Env; fetch: typeof fetch }): RawItem[] => [
				{
					externalId: 'title',
					url: 'https://example.com/title',
					title: 'Title',
				},
			],
		);
		const fetch = vi.fn().mockResolvedValue(new Response(SAMPLE_HTML, { status: 200 }));
		const extractor = createWebpageExtractor({
			url: 'https://example.com/page',
			headers: { accept: 'text/html' },
			parse,
		});

		const ctx = { env: {} as Env, fetch };
		const items = await extractor.extract(ctx);

		expect(extractor.kind).toBe('webpage');
		expect(fetch).toHaveBeenCalledWith('https://example.com/page', {
			headers: { accept: 'text/html' },
		});
		expect(parse).toHaveBeenCalledWith(SAMPLE_HTML, ctx);
		expect(items).toEqual([
			{
				externalId: 'title',
				url: 'https://example.com/title',
				title: 'Title',
			},
		]);
	});

	it('throws when webpage fetch fails', async () => {
		const fetch = vi
			.fn()
			.mockResolvedValue(new Response('error', { status: 404, statusText: 'Not Found' }));
		const extractor = createWebpageExtractor({
			url: 'https://example.com/missing',
			parse: (_html, _ctx) => [],
		});

		await expect(extractor.extract({ env: {} as Env, fetch })).rejects.toThrow(
			'Webpage fetch failed: 404 Not Found',
		);
	});
});
