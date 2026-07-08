const DEFAULT_RETRIES = 2;

export function isRetryableStatus(status: number): boolean {
	return status === 429 || (status >= 500 && status < 600);
}

export function retryDelayMs(attempt: number): number {
	return Math.min(1000 * 2 ** attempt, 5000);
}

export interface FetchWithRetryOptions {
	retries?: number;
	retryOn?: (response: Response) => boolean;
	delayMs?: (attempt: number) => number;
	sleep?: (ms: number) => Promise<void>;
}

export async function fetchWithRetry(
	fetchFn: typeof fetch,
	input: RequestInfo | URL,
	init?: RequestInit,
	options: FetchWithRetryOptions = {},
): Promise<Response> {
	const retries = options.retries ?? DEFAULT_RETRIES;
	const retryOn = options.retryOn ?? ((response) => isRetryableStatus(response.status));
	const delayMs = options.delayMs ?? retryDelayMs;
	const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));

	let lastResponse: Response | undefined;
	let lastError: unknown;

	for (let attempt = 0; attempt <= retries; attempt++) {
		try {
			const response = await fetchFn(input, init);
			if (response.ok || !retryOn(response) || attempt === retries) {
				return response;
			}
			lastResponse = response;
		} catch (error) {
			lastError = error;
			if (attempt === retries) {
				throw error;
			}
		}

		if (attempt < retries) {
			await sleep(delayMs(attempt));
		}
	}

	if (lastResponse) {
		return lastResponse;
	}

	throw lastError ?? new Error('Fetch failed with no response');
}

export function createRetryFetch(
	fetchFn: typeof fetch,
	options?: FetchWithRetryOptions,
): typeof fetch {
	return (input, init) => fetchWithRetry(fetchFn, input, init, options);
}
