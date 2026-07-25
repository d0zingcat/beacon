import { describe, expect, it, vi } from 'vitest';
import { isRetryableD1Error, withD1Retry } from './client';

describe('isRetryableD1Error', () => {
	it('matches Cloudflare D1 network blips', () => {
		expect(isRetryableD1Error(new Error('D1_ERROR: Network connection lost.'))).toBe(true);
		expect(isRetryableD1Error(new Error('UNIQUE constraint failed'))).toBe(false);
	});
});

describe('withD1Retry', () => {
	it('retries retryable D1 failures then succeeds', async () => {
		const sleep = vi.fn().mockResolvedValue(undefined);
		let attempts = 0;
		const result = await withD1Retry(
			async () => {
				attempts += 1;
				if (attempts < 3) {
					throw new Error('D1_ERROR: Network connection lost.');
				}
				return 'ok';
			},
			{ sleep, delayMs: () => 1 },
		);

		expect(result).toBe('ok');
		expect(attempts).toBe(3);
		expect(sleep).toHaveBeenCalledTimes(2);
	});

	it('does not retry non-retryable errors', async () => {
		const sleep = vi.fn().mockResolvedValue(undefined);
		await expect(
			withD1Retry(
				async () => {
					throw new Error('UNIQUE constraint failed');
				},
				{ sleep },
			),
		).rejects.toThrow('UNIQUE constraint failed');
		expect(sleep).not.toHaveBeenCalled();
	});
});
