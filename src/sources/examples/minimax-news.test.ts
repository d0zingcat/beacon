import { describe, expect, it } from 'vitest';
import {
	buildMinimaxDocsExternalId,
	buildMinimaxDocsUrl,
	buildMinimaxNewsUrl,
	normalizeMinimaxHref,
	parseMinimaxApisMarkdown,
	parseMinimaxChineseDate,
	parseMinimaxDocsBulletSections,
	parseMinimaxDocsCards,
	parseMinimaxModelsMarkdown,
	parseMinimaxNewsApiList,
	parseMinimaxPublishDate,
	stripMinimaxMarkdown,
} from './minimax-news';

const SAMPLE_NEWS = {
	data: [
		{
			newsId: '6a30cfd5bc6fac0f896b9a27',
			title: '华为云与MiniMax最新模型M3完成适配',
			summary: '6月12日，华为云与MiniMax原生多模态旗舰模型M3实现开源首发适配。',
			slug: 'huawei-cloud-minimax-m3-adaptation-copy',
			publishDate: 1781611200000,
			tags: ['合作', '模型适配'],
		},
		{
			newsId: '38ffaac6-67ac-497c-abee-aa32d62c825c',
			title: '昇腾0Day支持MiniMaxM2.7，共同开启模型自我进化新范式',
			slug: '昇腾0day支持minimaxm27共同开启模型自我进化新范式',
			publishDate: '2026-04-11T16:00:00.000Z',
			tags: ['MiniMax'],
		},
	],
};

const SAMPLE_MODELS = `
## 2026 年 6 月 1 日

<Card title="MiniMax M3" icon="file-text" href="https://platform.minimaxi.com/docs/guides/models-intro" cta="了解更多">
  全新语言模型 MiniMax-M3 正式发布，面向 Agent 推理、工具调用、代码、多模态 Chat 输入和长上下文任务。
</Card>

## 2026 年 4 月

<Card title="Music-2.6" icon="music" href="https://platform.minimaxi.com/docs/api-reference/music-generation" cta="了解更多">
  以声传情：翻唱入心，器乐入魂
</Card>
`;

const SAMPLE_APIS = `
### 2025 年 10 月 28 日

* **视频生成接口**，新增 **MiniMax-Hailuo-2.3** 和 **MiniMax-Hailuo-2.3-Fast** 两个模型
* **MiniMax-Hailuo-2.3** 模型支持文生视频（T2V）和图生视频（I2V）两种生成模式

### 2025 年 09 月 23 日

* T2A v2 接口，支持控制音频恒定比特率编码
`;

describe('parseMinimaxPublishDate', () => {
	it('parses millisecond timestamps', () => {
		expect(parseMinimaxPublishDate(1781611200000)).toBe('2026-06-16T12:00:00.000Z');
	});

	it('parses ISO strings', () => {
		expect(parseMinimaxPublishDate('2026-04-11T16:00:00.000Z')).toBe(
			'2026-04-11T16:00:00.000Z',
		);
	});
});

describe('parseMinimaxChineseDate', () => {
	it('parses full Chinese dates', () => {
		expect(parseMinimaxChineseDate('2026 年 6 月 1 日')).toBe('2026-06-01');
	});

	it('parses month-only Chinese dates', () => {
		expect(parseMinimaxChineseDate('2026 年 4 月')).toBe('2026-04-01');
	});
});

describe('parseMinimaxNewsApiList', () => {
	it('maps API entries to RawItem', () => {
		const items = parseMinimaxNewsApiList(SAMPLE_NEWS.data);

		expect(items).toEqual([
			{
				externalId: '6a30cfd5bc6fac0f896b9a27',
				url: 'https://www.minimaxi.com/news/huawei-cloud-minimax-m3-adaptation-copy',
				title: '华为云与MiniMax最新模型M3完成适配',
				summary: '6月12日，华为云与MiniMax原生多模态旗舰模型M3实现开源首发适配。',
				publishedAt: '2026-06-16T12:00:00.000Z',
			},
			{
				externalId: '38ffaac6-67ac-497c-abee-aa32d62c825c',
				url: 'https://www.minimaxi.com/news/昇腾0day支持minimaxm27共同开启模型自我进化新范式',
				title: '昇腾0Day支持MiniMaxM2.7，共同开启模型自我进化新范式',
				summary: 'MiniMax',
				publishedAt: '2026-04-11T16:00:00.000Z',
			},
		]);
	});
});

describe('parseMinimaxDocsCards', () => {
	it('extracts cards with preceding date headers', () => {
		const cards = parseMinimaxDocsCards(SAMPLE_MODELS);
		expect(cards).toHaveLength(2);
		expect(cards[0]).toMatchObject({
			date: '2026 年 6 月 1 日',
			title: 'MiniMax M3',
		});
		expect(cards[1]?.date).toBe('2026 年 4 月');
	});
});

describe('parseMinimaxDocsBulletSections', () => {
	it('groups bullets under api update dates', () => {
		const sections = parseMinimaxDocsBulletSections(SAMPLE_APIS);
		expect(sections).toHaveLength(2);
		expect(sections[0]?.bullets).toHaveLength(2);
	});
});

describe('parseMinimaxModelsMarkdown', () => {
	it('maps model cards to RawItem', () => {
		const items = parseMinimaxModelsMarkdown(SAMPLE_MODELS, {
			key: 'models',
			path: '/docs/release-notes/models',
			title: '模型发布',
			dateHeader: '##',
		});

		expect(items[0]).toEqual({
			externalId: 'models:2026 年 6 月 1 日:MiniMax M3',
			url: 'https://platform.minimaxi.com/docs/guides/models-intro',
			title: 'MiniMax M3',
			summary:
				'全新语言模型 MiniMax-M3 正式发布，面向 Agent 推理、工具调用、代码、多模态 Chat 输入和长上下文任务。',
			publishedAt: '2026-06-01T00:00:00.000Z',
		});
	});
});

describe('parseMinimaxApisMarkdown', () => {
	it('maps api bullet sections to RawItem', () => {
		const items = parseMinimaxApisMarkdown(SAMPLE_APIS, {
			key: 'apis',
			path: '/docs/release-notes/apis',
			title: '功能更新',
			dateHeader: '###',
		});

		expect(items[0]).toEqual({
			externalId:
				'apis:2025 年 10 月 28 日:视频生成接口，新增 MiniMax-Hailuo-2.3 和 MiniMax-Hailuo-2.3-Fast 两个模型',
			url: 'https://platform.minimaxi.com/docs/release-notes/apis#2025%20%E5%B9%B4%2010%20%E6%9C%88%2028%20%E6%97%A5',
			title: '视频生成接口，新增 MiniMax-Hailuo-2.3 和 MiniMax-Hailuo-2.3-Fast 两个模型',
			summary:
				'MiniMax-Hailuo-2.3 模型支持文生视频（T2V）和图生视频（I2V）两种生成模式',
			publishedAt: '2025-10-28T00:00:00.000Z',
		});
	});
});

describe('normalizeMinimaxHref', () => {
	it('keeps absolute urls', () => {
		expect(normalizeMinimaxHref('https://www.minimaxi.com/news/minimax-m25')).toBe(
			'https://www.minimaxi.com/news/minimax-m25',
		);
	});

	it('prefixes docs-relative urls', () => {
		expect(normalizeMinimaxHref('/api-reference/text-intro')).toBe(
			'https://platform.minimaxi.com/api-reference/text-intro',
		);
	});
});

describe('buildMinimaxNewsUrl', () => {
	it('builds news article url', () => {
		expect(buildMinimaxNewsUrl('minimax-m25')).toBe('https://www.minimaxi.com/news/minimax-m25');
	});
});

describe('buildMinimaxDocsUrl', () => {
	it('builds anchored docs url', () => {
		expect(buildMinimaxDocsUrl('/docs/release-notes/apis', '2025 年 10 月 28 日')).toBe(
			'https://platform.minimaxi.com/docs/release-notes/apis#2025%20%E5%B9%B4%2010%20%E6%9C%88%2028%20%E6%97%A5',
		);
	});
});

describe('buildMinimaxDocsExternalId', () => {
	it('combines page key, date, and title', () => {
		expect(buildMinimaxDocsExternalId('models', '2026 年 6 月 1 日', 'MiniMax M3')).toBe(
			'models:2026 年 6 月 1 日:MiniMax M3',
		);
	});
});

describe('stripMinimaxMarkdown', () => {
	it('removes bold markers and br tags', () => {
		expect(stripMinimaxMarkdown('**视频生成接口**，新增模型<br /><br />')).toBe(
			'视频生成接口，新增模型',
		);
	});
});
