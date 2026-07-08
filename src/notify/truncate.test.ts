import { describe, expect, it } from 'vitest';
import { truncateNotificationText } from './truncate';

describe('truncateNotificationText', () => {
	it('returns text unchanged when within limit', () => {
		expect(truncateNotificationText('hello', 10)).toBe('hello');
	});

	it('appends truncation suffix when over limit', () => {
		const result = truncateNotificationText('abcdefghijklmnop', 15);
		expect(result.endsWith('…（消息已截断）')).toBe(true);
		expect(result.length).toBeLessThanOrEqual(15);
	});
});
