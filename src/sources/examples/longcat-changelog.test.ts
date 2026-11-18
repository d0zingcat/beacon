import { describe, expect, it, vi } from 'vitest';
import {
	fetchLongcatChangelog,
	LONGCAT_CHANGELOG_URL,
	parseLongcatChangelogDate,
	parseLongcatChangelogHtml,
} from './longcat-changelog';

const SAMPLE_HTML = `
<html>
  <body>
    <main class="lc-main">
      <div class="lc-content vp-doc">
        <div>
          <h1 id="longcat-api开放平台更新日志" tabindex="-1">LongCat API开放平台更新日志 <a class="header-anchor" href="#longcat-api开放平台更新日志">​</a></h1>
          <div data-edition-only="ai">
            <h2 id="版本-2026-11-02" tabindex="-1">版本: 2026-11-02 <a class="header-anchor" href="#版本-2026-11-02">​</a></h2>
            <h3 id="longcat-2-5-上线" tabindex="-1">LongCat-2.5 上线 <a class="header-anchor" href="#longcat-2-5-上线">​</a></h3>
            <p>AI edition only description.</p>
            <h2 id="版本-2026-09-10" tabindex="-1">版本: 2026-09-10 <a class="header-anchor" href="#版本-2026-09-10">​</a></h2>
            <h3 id="全新推出企业服务" tabindex="-1">全新推出企业服务 <a class="header-anchor" href="#全新推出企业服务">​</a></h3>
            <p>AI edition enterprise service.</p>
          </div>
          <div data-edition-only="chat com">
            <h2 id="版本-2026-11-02-1" tabindex="-1">版本: 2026-11-02 <a class="header-anchor" href="#版本-2026-11-02-1">​</a></h2>
            <h3 id="longcat-2-5-上线-1" tabindex="-1">LongCat-2.5 上线 <a class="header-anchor" href="#longcat-2-5-上线-1">​</a></h3>
            <p>LongCat-2.5 的核心特性如下：</p>
            <ol><li><strong>原生多模态</strong>：融合视觉理解与智能体编程。</li></ol>
            <h2 id="版本-2026-09-02" tabindex="-1">版本: 2026-09-02 <a class="header-anchor" href="#版本-2026-09-02">​</a></h2>
            <h3 id="全新推出企业服务-1" tabindex="-1">全新推出企业服务 <a class="header-anchor" href="#全新推出企业服务-1">​</a></h3>
            <p>LongCat API 开放平台推出面向企业用户的服务能力。</p>
          </div>
          <h2 id="版本-2026-06-30" tabindex="-1">版本: 2026-06-30 <a class="header-anchor" href="#版本-2026-06-30">​</a></h2>
          <h3 id="longcat-2-0-发布" tabindex="-1">LongCat-2.0 发布 &amp; 全新推出计费服务 <a class="header-anchor" href="#longcat-2-0-发布">​</a></h3>
          <ul><li>万亿参数，1M超长上下文。</li></ul>
        </div>
      </div>
    </main>
  </body>
</html>
`;

describe('parseLongcatChangelogDate', () => {
	it('parses YYYY-MM-DD dates to UTC midnight ISO string', () => {
		expect(parseLongcatChangelogDate('2026-11-02')).toBe('2026-11-02T00:00:00.000Z');
		expect(parseLongcatChangelogDate('2025-08-29')).toBe('2025-08-29T00:00:00.000Z');
	});

	it('returns undefined for invalid calendar dates', () => {
		expect(parseLongcatChangelogDate('2026-02-30')).toBeUndefined();
		expect(parseLongcatChangelogDate('invalid')).toBeUndefined();
	});
});

describe('parseLongcatChangelogHtml', () => {
	it('ignores data-edition-only="ai" and parses chat/shared changelog entries', () => {
		const items = parseLongcatChangelogHtml(SAMPLE_HTML);
		expect(items).toEqual([
			{
				externalId: '2026-11-02',
				url: `${LONGCAT_CHANGELOG_URL}#版本-2026-11-02-1`,
				title: 'LongCat-2.5 上线',
				summary: 'LongCat-2.5 的核心特性如下： 原生多模态 ：融合视觉理解与智能体编程。',
				publishedAt: '2026-11-02T00:00:00.000Z',
			},
			{
				externalId: '2026-09-02',
				url: `${LONGCAT_CHANGELOG_URL}#版本-2026-09-02`,
				title: '全新推出企业服务',
				summary: 'LongCat API 开放平台推出面向企业用户的服务能力。',
				publishedAt: '2026-09-02T00:00:00.000Z',
			},
			{
				externalId: '2026-06-30',
				url: `${LONGCAT_CHANGELOG_URL}#版本-2026-06-30`,
				title: 'LongCat-2.0 发布 & 全新推出计费服务',
				summary: '万亿参数，1M超长上下文。',
				publishedAt: '2026-06-30T00:00:00.000Z',
			},
		]);
	});
});

describe('fetchLongcatChangelog', () => {
	it('fetches the changelog page and parses items', async () => {
		const fetchFn = vi.fn().mockResolvedValue(new Response(SAMPLE_HTML, { status: 200 }));
		const items = await fetchLongcatChangelog(fetchFn as unknown as typeof fetch);
		expect(fetchFn).toHaveBeenCalledWith(
			LONGCAT_CHANGELOG_URL,
			expect.objectContaining({
				headers: expect.objectContaining({ accept: 'text/html,application/xhtml+xml' }),
			}),
		);
		expect(items.map((item) => item.externalId)).toEqual(['2026-11-02', '2026-09-02', '2026-06-30']);
	});

	it('throws on HTTP error responses', async () => {
		const fetchFn = vi.fn().mockResolvedValue(new Response('err', { status: 503, statusText: 'Unavailable' }));
		await expect(fetchLongcatChangelog(fetchFn as unknown as typeof fetch)).rejects.toThrow(
			'LongCat changelog fetch failed: 503',
		);
	});
});
