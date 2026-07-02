import { describe, expect, it } from 'vitest';
import { formatPublishedAt, formatTitleWithPublishedAt } from './format-time';

describe('formatPublishedAt', () => {
	it('formats epoch ms in Asia/Shanghai', () => {
		const publishedAt = Date.parse('2026-07-01T01:30:00.000Z');
		expect(formatPublishedAt(publishedAt)).toBe('2026/7/1 09:30');
	});
});

describe('formatTitleWithPublishedAt', () => {
	it('appends published time after title', () => {
		const publishedAt = Date.parse('2026-07-01T01:30:00.000Z');
		expect(formatTitleWithPublishedAt('New feature', publishedAt)).toBe(
			'New feature · 2026/7/1 09:30',
		);
	});

	it('returns title unchanged when publishedAt is missing', () => {
		expect(formatTitleWithPublishedAt('New feature')).toBe('New feature');
	});
});
