import { describe, expect, it } from 'vitest';
import { consolidateAppendNotifications } from './consolidate';

const append = (itemId: number, title: string) => ({
	kind: 'append' as const,
	sourceId: 'openai-blog',
	sourceName: 'OpenAI Blog',
	itemId,
	title,
});

describe('consolidateAppendNotifications', () => {
	it('returns events unchanged for a single append', () => {
		const events = [append(1, 'One')];
		expect(consolidateAppendNotifications(events)).toEqual(events);
	});

	it('merges multiple append events into append_batch', () => {
		const result = consolidateAppendNotifications([append(1, 'One'), append(2, 'Two')], 10);
		expect(result).toEqual([
			{
				kind: 'append_batch',
				sourceId: 'openai-blog',
				sourceName: 'OpenAI Blog',
				maxItems: 10,
				items: [
					{ itemId: 1, title: 'One' },
					{ itemId: 2, title: 'Two' },
				],
			},
		]);
	});

	it('keeps non-append events after the batch', () => {
		const result = consolidateAppendNotifications(
			[
				append(1, 'One'),
				append(2, 'Two'),
				{
					kind: 'crawl_error',
					sourceId: 'openai-blog',
					sourceName: 'OpenAI Blog',
					error: 'boom',
				},
			],
			5,
		);
		expect(result).toHaveLength(2);
		expect(result[0]).toMatchObject({ kind: 'append_batch', maxItems: 5 });
		expect(result[1]).toMatchObject({ kind: 'crawl_error' });
	});
});
