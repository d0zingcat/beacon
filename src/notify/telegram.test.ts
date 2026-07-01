import { describe, expect, it } from 'vitest';
import { formatCrawlErrorEvent } from './telegram';

describe('formatCrawlErrorEvent', () => {
	it('formats crawl error notification', () => {
		expect(
			formatCrawlErrorEvent({
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
