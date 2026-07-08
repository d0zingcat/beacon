import { describe, expect, it } from 'vitest';
import { formatAppendBatchEvent } from './format-batch';

const publishedAt = Date.parse('2026-06-25T12:00:00.000Z');

describe('formatAppendBatchEvent', () => {
	it('formats a batch with numbered items and overflow footer', () => {
		const text = formatAppendBatchEvent({
			kind: 'append_batch',
			sourceId: 'openai-blog',
			sourceName: 'OpenAI Blog',
			maxItems: 2,
			items: [
				{
					itemId: 1,
					title: 'Article A',
					url: 'https://example.com/a',
					publishedAt,
				},
				{
					itemId: 2,
					title: 'Article B',
					url: 'https://example.com/b',
				},
				{ itemId: 3, title: 'Article C' },
			],
		});

		expect(text).toContain('📰 新条目 · OpenAI Blog（3 条）');
		expect(text).toContain('1. Article A · 2026/6/25 20:00');
		expect(text).toContain('🔗 https://example.com/a');
		expect(text).toContain('2. Article B');
		expect(text).not.toContain('3. Article C');
		expect(text).toContain('… 另有 1 条未列出');
	});

	it('truncates when the message exceeds the text limit', () => {
		const text = formatAppendBatchEvent({
			kind: 'append_batch',
			sourceId: 'openai-blog',
			sourceName: 'OpenAI Blog',
			maxItems: 10,
			items: [
				{
					itemId: 1,
					title: 'X'.repeat(5_000),
					url: 'https://example.com/0',
				},
			],
		});

		expect(text.length).toBeLessThanOrEqual(4_000);
		expect(text).toContain('…（消息已截断）');
	});
});
