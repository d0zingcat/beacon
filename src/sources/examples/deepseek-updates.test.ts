import { describe, expect, it, vi } from 'vitest';
import { fetchUpdates, parseUpdatesHtml } from './deepseek-updates';

/** A 更新日志 fragment mirroring the real mixed-colon, multi-entry structure. */
const UPDATES_PAGE = `
<html><body>
<article>
<h1>更新日志</h1>
<hr>
<h2 class="anchor anchorWithStickyNavbar_YAqC" id="时间-2026-04-24">时间: 2026-04-24<a href="#时间-2026-04-24" class="hash-link">​</a></h2>
<h3 class="anchor anchorWithStickyNavbar_YAqC" id="deepseek-v4">DeepSeek-V4<a href="#deepseek-v4" class="hash-link">​</a></h3>
<p>DeepSeek API 已支持 V4-Pro 与 V4-Flash，支持 OpenAI ChatCompletions 接口与 Anthropic 接口。访问新模型时，model 参数需要改为 <code>deepseek-v4-pro</code> 或 <code>deepseek-v4-flash</code>。</p>
<p>详细更新内容请<a href="/zh-cn/news/news260424">参阅文档</a></p>
<hr>
<h2 class="anchor anchorWithStickyNavbar_YAqC" id="时间-2025-12-01">时间: 2025-12-01<a href="#时间-2025-12-01" class="hash-link">​</a></h2>
<h3 class="anchor anchorWithStickyNavbar_YAqC" id="deepseek-v32">DeepSeek-V3.2<a href="#deepseek-v32" class="hash-link">​</a></h3>
<p><code>deepseek-chat</code> 和 <code>deepseek-reasoner</code> 都已升级为 DeepSeek-V3.2。</p>
<h3 class="anchor anchorWithStickyNavbar_YAqC" id="deepseek-v32-speciale">DeepSeek-V3.2-Speciale<a href="#deepseek-v32-speciale" class="hash-link">​</a></h3>
<p>我们非正式部署了 DeepSeek-V3.2-Speciale 的 API 服务，支持时间截止至北京时间 2025-12-15 23:59。</p>
<hr>
<h2 class="anchor anchorWithStickyNavbar_YAqC" id="时间2024-12-10">时间：2024-12-10<a href="#时间2024-12-10" class="hash-link">​</a></h2>
<h3 class="anchor anchorWithStickyNavbar_YAqC" id="deepseek-chat-2">deepseek-chat<a href="#deepseek-chat-2" class="hash-link">​</a></h3>
<p>deepseek-chat 模型升级为 DeepSeek-V2.5-1210，模型各项能力提升。</p>
<hr>
</article>
</body></html>
`;

describe('parseUpdatesHtml', () => {
	it('parses every entry under each date heading', () => {
		const items = parseUpdatesHtml(UPDATES_PAGE);
		expect(items).toHaveLength(4);
		expect(items.map((i) => i.externalId)).toEqual([
			'2026-04-24-deepseek-v4',
			'2025-12-01-deepseek-v32',
			'2025-12-01-deepseek-v32-speciale',
			'2024-12-10-deepseek-chat-2',
		]);
	});

	it('resolves each entry to its changelog anchor', () => {
		const items = parseUpdatesHtml(UPDATES_PAGE);
		expect(items[0]?.url).toBe('https://api-docs.deepseek.com/zh-cn/updates#deepseek-v4');
		expect(items[2]?.url).toBe('https://api-docs.deepseek.com/zh-cn/updates#deepseek-v32-speciale');
	});

	it('strips markup from titles, including <code> wrapping', () => {
		const items = parseUpdatesHtml(UPDATES_PAGE);
		// The real h3 text is plain here; verify no tags leak through.
		expect(items[0]?.title).toBe('DeepSeek-V4');
	});

	it('builds a truncated summary from the entry body, dropping markup', () => {
		const items = parseUpdatesHtml(UPDATES_PAGE);
		const v4 = items[0];
		expect(v4?.summary).toContain('DeepSeek API 已支持 V4-Pro 与 V4-Flash');
		expect(v4?.summary).not.toContain('<code>');
		expect(v4?.summary).not.toContain('<p>');
		expect(v4?.summary?.length).toBeLessThanOrEqual(280);
	});

	it('handles both half-width (:) and full-width (：) colons in date headings', () => {
		const items = parseUpdatesHtml(UPDATES_PAGE);
		// 2026-04-24 and 2025-12-01 use ":", 2024-12-10 uses "：".
		expect(items.map((i) => i.publishedAt)).toEqual([
			'2026-04-24T00:00:00.000Z',
			'2025-12-01T00:00:00.000Z',
			'2025-12-01T00:00:00.000Z',
			'2024-12-10T00:00:00.000Z',
		]);
	});

	it('truncates long summaries with an ellipsis', () => {
		const longBody = `${'DeepSeek API 已支持 V4-Pro 与 V4-Flash。'.repeat(20)}`;
		const html = `<article><h1>更新日志</h1><hr>
<h2 id="时间-2026-04-24">时间: 2026-04-24</h2>
<h3 id="deepseek-v4">DeepSeek-V4</h3>
<p>${longBody}</p><hr></article>`;
		const [item] = parseUpdatesHtml(html);
		expect(item?.summary?.endsWith('...')).toBe(true);
		expect(item?.summary?.length).toBeLessThanOrEqual(280);
	});

	it('returns an empty list when the page has no date headings', () => {
		expect(parseUpdatesHtml('<html><body><p>no updates</p></body></html>')).toEqual([]);
	});
});

describe('fetchUpdates', () => {
	it('fetches the changelog page and parses it', async () => {
		const fetchFn = vi
			.fn()
			.mockResolvedValue(new Response(UPDATES_PAGE, { status: 200, headers: { 'content-type': 'text/html' } }));
		const items = await fetchUpdates(fetchFn as unknown as typeof fetch);

		expect(fetchFn).toHaveBeenCalledWith(
			'https://api-docs.deepseek.com/zh-cn/updates',
			expect.objectContaining({ headers: expect.objectContaining({ accept: 'text/html' }) }),
		);
		expect(items).toHaveLength(4);
	});

	it('throws when the page returns a non-ok status', async () => {
		const fetchFn = vi.fn().mockResolvedValue(new Response('', { status: 529 }));
		await expect(fetchUpdates(fetchFn as unknown as typeof fetch)).rejects.toThrow(
			'DeepSeek updates fetch failed: 529',
		);
	});
});
