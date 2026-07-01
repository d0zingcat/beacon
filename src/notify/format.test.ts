import { describe, expect, it } from 'vitest';
import { formatNotification } from './format';

describe('formatNotification', () => {
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
				'[beacon] 新条目 · Kiro Changelog',
				'New feature',
				'A short summary',
				'https://example.com/post',
			].join('\n'),
		);
	});

	it('formats state_change event', () => {
		expect(
			formatNotification({
				kind: 'state_change',
				sourceId: 'vps-stock',
				sourceName: 'VPS Stock Monitor',
				itemId: 2,
				title: 'Plan A',
				url: 'https://example.com/vps',
				diff: { available: { from: false, to: true } },
			}),
		).toContain('[beacon] 状态变化 · VPS Stock Monitor');
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
				'[beacon] 抓取失败 · Kiro Changelog',
				'source: kiro-changelog',
				'RSS fetch failed: 403 Forbidden',
			].join('\n'),
		);
	});
});
