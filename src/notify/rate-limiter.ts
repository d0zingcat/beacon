export function sleep(ms: number): Promise<void> {
	if (ms <= 0) {
		return Promise.resolve();
	}
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface SerialRateLimiter {
	schedule<T>(task: () => Promise<T>): Promise<T>;
}

/** Runs tasks one at a time in FIFO order within the same isolate. */
export function createSerialRateLimiter(): SerialRateLimiter {
	let chain: Promise<unknown> = Promise.resolve();

	return {
		schedule<T>(task: () => Promise<T>): Promise<T> {
			const run = chain.then(task);
			chain = run.catch(() => {});
			return run;
		},
	};
}
