import { describe, expect, it, vi } from 'vitest';
import { createRetryFetch, fetchWithRetry, isRetryableStatus, retryDelayMs } from './retry';

describe('isRetryableStatus', () => {
	it('retries 429 and 5xx', () => {
		expect(isRetryableStatus(429)).toBe(true);
		expect(isRetryableStatus(500)).toBe(true);
		expect(isRetryableStatus(503)).toBe(true);
	});

	it('does not retry other statuses', () => {
		expect(isRetryableStatus(404)).toBe(false);
		expect(isRetryableStatus(403)).toBe(false);
	});
});

describe('retryDelayMs', () => {
	it('uses exponential backoff capped at 5s', () => {
		expect(retryDelayMs(0)).toBe(1000);
		expect(retryDelayMs(1)).toBe(2000);
		expect(retryDelayMs(2)).toBe(4000);
		expect(retryDelayMs(3)).toBe(5000);
	});
});

describe('fetchWithRetry', () => {
	it('returns successful response immediately', async () => {
		const fetchFn = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
		const sleep = vi.fn().mockResolvedValue(undefined);

		const response = await fetchWithRetry(fetchFn, 'https://example.com', undefined, { sleep });

		expect(response.status).toBe(200);
		expect(fetchFn).toHaveBeenCalledTimes(1);
		expect(sleep).not.toHaveBeenCalled();
	});

	it('retries retryable responses and succeeds', async () => {
		const fetchFn = vi
			.fn()
			.mockResolvedValueOnce(new Response('error', { status: 503, statusText: 'Unavailable' }))
			.mockResolvedValueOnce(new Response('ok', { status: 200 }));
		const sleep = vi.fn().mockResolvedValue(undefined);

		const response = await fetchWithRetry(fetchFn, 'https://example.com', undefined, {
			retries: 2,
			sleep,
		});

		expect(response.status).toBe(200);
		expect(fetchFn).toHaveBeenCalledTimes(2);
		expect(sleep).toHaveBeenCalledTimes(1);
	});

	it('returns the last retryable response after exhausting retries', async () => {
		const fetchFn = vi
			.fn()
			.mockResolvedValue(new Response('error', { status: 500, statusText: 'Error' }));
		const sleep = vi.fn().mockResolvedValue(undefined);

		const response = await fetchWithRetry(fetchFn, 'https://example.com', undefined, {
			retries: 2,
			sleep,
		});

		expect(response.status).toBe(500);
		expect(fetchFn).toHaveBeenCalledTimes(3);
		expect(sleep).toHaveBeenCalledTimes(2);
	});

	it('does not retry non-retryable responses', async () => {
		const fetchFn = vi
			.fn()
			.mockResolvedValue(new Response('missing', { status: 404, statusText: 'Not Found' }));
		const sleep = vi.fn().mockResolvedValue(undefined);

		const response = await fetchWithRetry(fetchFn, 'https://example.com', undefined, { sleep });

		expect(response.status).toBe(404);
		expect(fetchFn).toHaveBeenCalledTimes(1);
		expect(sleep).not.toHaveBeenCalled();
	});

	it('retries network errors', async () => {
		const fetchFn = vi
			.fn()
			.mockRejectedValueOnce(new Error('network down'))
			.mockResolvedValueOnce(new Response('ok', { status: 200 }));
		const sleep = vi.fn().mockResolvedValue(undefined);

		const response = await fetchWithRetry(fetchFn, 'https://example.com', undefined, {
			retries: 1,
			sleep,
		});

		expect(response.status).toBe(200);
		expect(fetchFn).toHaveBeenCalledTimes(2);
	});
});

describe('createRetryFetch', () => {
	it('wraps fetch with retry behavior', async () => {
		const fetchFn = vi
			.fn()
			.mockResolvedValueOnce(new Response('error', { status: 502, statusText: 'Bad Gateway' }))
			.mockResolvedValueOnce(new Response('ok', { status: 200 }));
		const sleep = vi.fn().mockResolvedValue(undefined);
		const retryFetch = createRetryFetch(fetchFn, { sleep });

		const response = await retryFetch('https://example.com');

		expect(response.status).toBe(200);
		expect(fetchFn).toHaveBeenCalledTimes(2);
	});
});
