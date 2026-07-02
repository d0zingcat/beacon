import { describe, expect, it } from 'vitest';
import { formatDmitStateDiff } from './format-dmit';
import { formatNotification } from './format';

const publishedAt = Date.parse('2026-07-01T01:30:00.000Z');

describe('formatDmitStateDiff', () => {
	it('formats available change with price from summary', () => {
		expect(
			formatDmitStateDiff({ available: { from: false, to: true } }, '$39.9/月'),
		).toEqual(['📦 库存: ❌ 缺货 → ✅ 有货', '💰 价格: $39.9/月']);
	});

	it('formats available change to out of stock without price', () => {
		expect(formatDmitStateDiff({ available: { from: true, to: false } }, '缺货')).toEqual([
			'📦 库存: ✅ 有货 → ❌ 缺货',
		]);
	});

	it('formats price change', () => {
		expect(
			formatDmitStateDiff({
				price: { from: '$39.9/月', to: '$49.9/月' },
			}),
		).toEqual(['💰 价格: $39.9/月 → $49.9/月']);
	});

	it('formats snapshot state', () => {
		expect(
			formatDmitStateDiff({
				snapshot: {
					available: true,
					price: '$39.9/月',
					source: 'stock.qixi.me',
				},
			}),
		).toEqual(['📦 库存: ✅ 有货', '💰 价格: $39.9/月']);
	});
});

describe('formatNotification', () => {
	it('formats append event with published time beside title', () => {
		expect(
			formatNotification({
				kind: 'append',
				sourceId: 'kiro-changelog',
				sourceName: 'Kiro Changelog',
				itemId: 1,
				title: 'New feature',
				url: 'https://example.com/post',
				summary: 'A short summary',
				publishedAt,
			}),
		).toBe(
			[
				'📰 新条目 · Kiro Changelog',
				'New feature · 2026/7/1 09:30',
				'A short summary',
				'🔗 https://example.com/post',
			].join('\n'),
		);
	});

	it('formats append event', () => {
		expect(
			formatNotification({
				kind: 'append',
				sourceId: 'kiro-changelog',
				sourceName: 'Kiro Changelog',
				itemId: 1,
				title: 'New feature',
				url: 'https://example.com/post',
				summary: 'A short summary',
			}),
		).toBe(
			[
				'📰 新条目 · Kiro Changelog',
				'New feature',
				'A short summary',
				'🔗 https://example.com/post',
			].join('\n'),
		);
	});

	it('formats dmit stock state_change event', () => {
		expect(
			formatNotification({
				kind: 'state_change',
				sourceId: 'dmit-stock',
				sourceName: 'DMIT VPS Stock',
				itemId: 2,
				title: 'HKG.AS3.T1.TINY',
				url: 'https://www.dmit.io/aff.php?aff=23808&pid=201',
				summary: '$39.9/月',
				diff: { available: { from: false, to: true } },
			}),
		).toBe(
			[
				'🔔 状态变化 · DMIT VPS Stock',
				'HKG.AS3.T1.TINY',
				'📦 库存: ❌ 缺货 → ✅ 有货',
				'💰 价格: $39.9/月',
				'🔗 https://www.dmit.io/aff.php?aff=23808&pid=201',
			].join('\n'),
		);
	});

	it('keeps generic JSON diff for non-dmit state_change events', () => {
		expect(
			formatNotification({
				kind: 'state_change',
				sourceId: 'other-source',
				sourceName: 'Other Source',
				itemId: 3,
				title: 'Item A',
				url: 'https://example.com/item',
				summary: 'ignored for generic formatter',
				diff: { status: { from: 'old', to: 'new' } },
			}),
		).toBe(
			[
				'🔔 状态变化 · Other Source',
				'Item A',
				'{\n  "status": {\n    "from": "old",\n    "to": "new"\n  }\n}',
				'🔗 https://example.com/item',
			].join('\n'),
		);
	});

	it('formats crawl_error event', () => {
		expect(
			formatNotification({
				kind: 'crawl_error',
				sourceId: 'kiro-changelog',
				sourceName: 'Kiro Changelog',
				error: 'RSS fetch failed: 403 Forbidden',
			}),
		).toBe(
			[
				'⚠️ 抓取失败 · Kiro Changelog',
				'📌 source: kiro-changelog',
				'❌ RSS fetch failed: 403 Forbidden',
			].join('\n'),
		);
	});
});
