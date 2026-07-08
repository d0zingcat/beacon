import { describe, expect, it, vi } from 'vitest';
import {
	buildBigmodelNewsExternalId,
	buildBigmodelNewsUrl,
	fetchBigmodelNewsList,
	parseBigmodelNewsMarkdown,
	parseBigmodelUpdateBlocks,
	parseBigmodelUpdateSummary,
	stripBigmodelMarkdown,
} from './bigmodel-news';

const SAMPLE_MARKDOWN = `
# 新品发布

<Update label="2026-06-16" description="GLM-5.2 新一代旗舰模型上线">
  💬 [**GLM-5.2**](/cn/guide/models/text/glm-5.2)

  * 支持 1M 无损上下文，长程任务能力显著提升
  * Coding 与长程任务评测达到开源 SOTA
</Update>

<Update label="2026-04-07" description="GLM-5.1 新一代旗舰模型上线">
  💬 [**GLM-5.1**](/cn/guide/models/text/glm-5.1)

  * Coding 能力大大增强，长程任务显著提升
</Update>
`;

const FEATURE_SAMPLE = `
<Update label="2025-05-07" description="【AI搜索工具】新增多项实用参数">
  Web Search API 和 API Search in Chat 本次更新新增多项实用参数。

  **1.请求参数扩展**

  * **count**：支持自定义返回的搜索结果数量。
</Update>
`;

describe('parseBigmodelUpdateBlocks', () => {
	it('extracts update entries from mintlify markdown', () => {
		const entries = parseBigmodelUpdateBlocks(SAMPLE_MARKDOWN);
		expect(entries).toHaveLength(2);
		expect(entries[0]).toMatchObject({
			date: '2026-06-16',
			description: 'GLM-5.2 新一代旗舰模型上线',
		});
	});
});

describe('parseBigmodelUpdateSummary', () => {
	it('uses the first bullet as summary', () => {
		const body = parseBigmodelUpdateBlocks(SAMPLE_MARKDOWN)[0]?.body ?? '';
		expect(parseBigmodelUpdateSummary(body)).toBe('支持 1M 无损上下文，长程任务能力显著提升');
	});

	it('uses the first bullet when present', () => {
		const body = parseBigmodelUpdateBlocks(FEATURE_SAMPLE)[0]?.body ?? '';
		expect(parseBigmodelUpdateSummary(body)).toBe('count：支持自定义返回的搜索结果数量。');
	});
});

describe('stripBigmodelMarkdown', () => {
	it('removes links and bold markers', () => {
		expect(stripBigmodelMarkdown('**count**：支持自定义返回的搜索结果数量。')).toBe(
			'count：支持自定义返回的搜索结果数量。',
		);
	});
});

describe('parseBigmodelNewsMarkdown', () => {
	it('maps update blocks to RawItem', () => {
		const items = parseBigmodelNewsMarkdown(SAMPLE_MARKDOWN, {
			key: 'new-releases',
			path: '/cn/update/new-releases',
			title: '新品发布',
		});

		expect(items).toEqual([
			{
				externalId: 'new-releases:2026-06-16:GLM-5.2 新一代旗舰模型上线',
				url: 'https://docs.bigmodel.cn/cn/update/new-releases#2026-06-16',
				title: 'GLM-5.2 新一代旗舰模型上线',
				summary: '支持 1M 无损上下文，长程任务能力显著提升',
				publishedAt: '2026-06-16T00:00:00.000Z',
			},
			{
				externalId: 'new-releases:2026-04-07:GLM-5.1 新一代旗舰模型上线',
				url: 'https://docs.bigmodel.cn/cn/update/new-releases#2026-04-07',
				title: 'GLM-5.1 新一代旗舰模型上线',
				summary: 'Coding 能力大大增强，长程任务显著提升',
				publishedAt: '2026-04-07T00:00:00.000Z',
			},
		]);
	});
});

describe('buildBigmodelNewsUrl', () => {
	it('builds anchored docs url', () => {
		expect(buildBigmodelNewsUrl('/cn/update/new-releases', '2026-06-16')).toBe(
			'https://docs.bigmodel.cn/cn/update/new-releases#2026-06-16',
		);
	});
});

describe('buildBigmodelNewsExternalId', () => {
	it('combines page key, date, and description', () => {
		expect(buildBigmodelNewsExternalId('feature-updates', '2025-05-07', 'title')).toBe(
			'feature-updates:2025-05-07:title',
		);
	});
});

describe('fetchBigmodelNewsList', () => {
	it('returns items from successful pages when another page fails', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const fetchFn = vi.fn(async (url: string) => {
			if (url.endsWith('/cn/update/new-releases.md')) {
				return new Response(SAMPLE_MARKDOWN, { status: 200 });
			}
			return new Response('error', { status: 500, statusText: 'Internal Server Error' });
		});

		const items = await fetchBigmodelNewsList(fetchFn);

		expect(items).toHaveLength(2);
		expect(items[0]?.externalId).toBe('new-releases:2026-06-16:GLM-5.2 新一代旗舰模型上线');
		expect(warn).toHaveBeenCalled();
		warn.mockRestore();
	});

	it('throws when every page fails', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const fetchFn = vi
			.fn()
			.mockResolvedValue(new Response('error', { status: 500, statusText: 'Internal Server Error' }));

		await expect(fetchBigmodelNewsList(fetchFn)).rejects.toThrow(
			'BigModel docs fetch failed for /cn/update/new-releases: 500 Internal Server Error',
		);
		warn.mockRestore();
	});
});
