import { describe, expect, it } from 'vitest';
import {
	buildHunyuanNewsUrl,
	parseHunyuanNewsList,
	parseHunyuanNewsTimestamp,
} from './hy-news';

const SAMPLE_LIST = {
	totalNum: 2,
	list: [
		{
			id: 100064,
			customUrl: 'hy3',
			title: 'Introducing Hy3',
			author: 'Hy LLM',
			displayPublishTime: 1783440000,
			publishedAt: 1783319811,
		},
		{
			id: 100039,
			title: 'Real life is where context gets hard',
			desc: 'Previously, we built CL-Bench to test whether AI could learn complex new knowledge.',
			publishedAt: 1777227059,
		},
	],
};

describe('parseHunyuanNewsList', () => {
	it('maps API entries to RawItem', () => {
		const items = parseHunyuanNewsList(SAMPLE_LIST);

		expect(items).toEqual([
			{
				externalId: 'hy3',
				url: 'https://hy.tencent.com/research/hy3',
				title: 'Introducing Hy3',
				summary: 'Hy LLM',
				publishedAt: new Date(1783440000 * 1000).toISOString(),
			},
			{
				externalId: '100039',
				url: 'https://hy.tencent.com/research/100039',
				title: 'Real life is where context gets hard',
				summary:
					'Previously, we built CL-Bench to test whether AI could learn complex new knowledge.',
				publishedAt: new Date(1777227059 * 1000).toISOString(),
			},
		]);
	});

	it('deduplicates by slug', () => {
		const items = parseHunyuanNewsList({
			list: [
				{ id: 1, customUrl: 'hy3', title: 'First' },
				{ id: 2, customUrl: 'hy3', title: 'Duplicate' },
			],
		});

		expect(items).toHaveLength(1);
		expect(items[0]?.title).toBe('First');
	});
});

describe('buildHunyuanNewsUrl', () => {
	it('prefers customUrl slug', () => {
		expect(buildHunyuanNewsUrl({ id: 100061, customUrl: 'hy3-preview' })).toBe(
			'https://hy.tencent.com/research/hy3-preview',
		);
	});
});

describe('parseHunyuanNewsTimestamp', () => {
	it('prefers displayPublishTime', () => {
		expect(
			parseHunyuanNewsTimestamp({
				id: 1,
				title: 't',
				displayPublishTime: 1783440000,
				publishedAt: 1783319811,
			}),
		).toBe(new Date(1783440000 * 1000).toISOString());
	});
});
