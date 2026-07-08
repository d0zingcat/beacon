import { describe, expect, it, vi } from 'vitest';
import { fetchNewsIndex, parseNewsIndexHtml } from './deepseek-news';

/** A Docusaurus sidebar fragment mirroring the real 新闻 archive list. */
const SIDEBAR = `
<ul class="menu__list">
  <li><a class="menu__link menu__link--active" aria-current="page" tabindex="0" href="/zh-cn/news/news260424">DeepSeek-V4 预览版发布 2026/04/24</a></li>
  <li><a class="menu__link" tabindex="0" href="/zh-cn/news/news251201">DeepSeek-V3.2 正式版发布 2025/12/01</a></li>
  <li><a class="menu__link" tabindex="0" href="/zh-cn/news/news250120">DeepSeek-R1 发布 2025/01/20</a></li>
  <li><a class="menu__link" tabindex="0" href="/zh-cn/news/news0725">API 升级新功能 2024/07/25</a></li>
</ul>
`;

const FULL_PAGE = `
<html><body>
<aside>
  <a class="menu__link menu__link--sublist menu__link--sublist-caret menu__link--active" aria-expanded="true" href="/zh-cn/news/news260424">新闻</a>
  <ul><li><a class="menu__link menu__link--active" aria-current="page" tabindex="0" href="/zh-cn/news/news260424">DeepSeek-V4 预览版发布 2026/04/24</a></li></ul>
</aside>
<article>
  <h1>DeepSeek-V4 预览版：迈入百万上下文普惠时代</h1>
  ${SIDEBAR}
</article>
</body></html>
`;

describe('parseNewsIndexHtml', () => {
	it('extracts every news article with title, url and trailing date', () => {
		const items = parseNewsIndexHtml(FULL_PAGE);
		expect(items).toEqual([
			{
				externalId: 'news-260424',
				url: 'https://api-docs.deepseek.com/zh-cn/news/news260424',
				title: 'DeepSeek-V4 预览版发布',
				publishedAt: '2026-04-24T00:00:00.000Z',
			},
			{
				externalId: 'news-251201',
				url: 'https://api-docs.deepseek.com/zh-cn/news/news251201',
				title: 'DeepSeek-V3.2 正式版发布',
				publishedAt: '2025-12-01T00:00:00.000Z',
			},
			{
				externalId: 'news-250120',
				url: 'https://api-docs.deepseek.com/zh-cn/news/news250120',
				title: 'DeepSeek-R1 发布',
				publishedAt: '2025-01-20T00:00:00.000Z',
			},
			{
				externalId: 'news-0725',
				url: 'https://api-docs.deepseek.com/zh-cn/news/news0725',
				title: 'API 升级新功能',
				publishedAt: '2024-07-25T00:00:00.000Z',
			},
		]);
	});

	it('skips the parent category link and links without a trailing date', () => {
		// The parent "新闻" category link and pagination links have no date and must be dropped.
		const html = `
<a class="menu__link menu__link--sublist menu__link--sublist-caret" aria-expanded="false" href="/zh-cn/news/news260424">新闻</a>
<a class="pagination-nav__link pagination-nav__link--next" href="/zh-cn/news/news251201">DeepSeek V3.2 正式版：强化 Agent 能力，融入思考推理</a>
<a class="menu__link" tabindex="0" href="/zh-cn/news/news251201">DeepSeek-V3.2 正式版发布 2025/12/01</a>
`;
		const items = parseNewsIndexHtml(html);
		expect(items).toHaveLength(1);
		expect(items[0]?.externalId).toBe('news-251201');
	});

	it('dedupes articles that share a slug', () => {
		const html = `
<a class="menu__link menu__link--active" aria-current="page" href="/zh-cn/news/news260424">DeepSeek-V4 预览版发布 2026/04/24</a>
<a class="menu__link" tabindex="0" href="/zh-cn/news/news260424">DeepSeek-V4 预览版发布 2026/04/24</a>
`;
		const items = parseNewsIndexHtml(html);
		expect(items).toHaveLength(1);
	});

	it('returns an empty list when no news links are present', () => {
		expect(parseNewsIndexHtml('<html><body><p>nothing here</p></body></html>')).toEqual([]);
	});

	it('drops an entry whose link text has no trailing date', () => {
		const html = '<a class="menu__link" tabindex="0" href="/zh-cn/news/news260424">No date here</a>';
		expect(parseNewsIndexHtml(html)).toEqual([]);
	});
});

describe('fetchNewsIndex', () => {
	it('fetches the latest news page and parses its sidebar', async () => {
		const fetchFn = vi
			.fn()
			.mockResolvedValue(new Response(FULL_PAGE, { status: 200, headers: { 'content-type': 'text/html' } }));
		const items = await fetchNewsIndex(fetchFn as unknown as typeof fetch);

		expect(fetchFn).toHaveBeenCalledWith(
			'https://api-docs.deepseek.com/zh-cn/news/news260424',
			expect.objectContaining({ headers: expect.objectContaining({ accept: 'text/html' }) }),
		);
		expect(items).toHaveLength(4);
		expect(items[0]?.externalId).toBe('news-260424');
	});

	it('throws when the page returns a non-ok status', async () => {
		const fetchFn = vi.fn().mockResolvedValue(new Response('', { status: 503 }));
		await expect(fetchNewsIndex(fetchFn as unknown as typeof fetch)).rejects.toThrow(
			'DeepSeek news fetch failed: 503',
		);
	});
});
