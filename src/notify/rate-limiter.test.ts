import { describe, expect, it, vi } from 'vitest';
import { createSerialRateLimiter, sleep } from './rate-limiter';

describe('sleep', () => {
	it('resolves immediately for non-positive delay', async () => {
		const start = Date.now();
		await sleep(0);
		await sleep(-1);
		expect(Date.now() - start).toBeLessThan(20);
	});
});

describe('createSerialRateLimiter', () => {
	it('runs tasks in order', async () => {
		const limiter = createSerialRateLimiter();
		const order: number[] = [];

		await Promise.all([
			limiter.schedule(async () => {
				order.push(1);
			}),
			limiter.schedule(async () => {
				order.push(2);
			}),
			limiter.schedule(async () => {
				order.push(3);
			}),
		]);

		expect(order).toEqual([1, 2, 3]);
	});

	it('does not start the next task until the previous one finishes', async () => {
		const limiter = createSerialRateLimiter();
		let concurrent = 0;
		let maxConcurrent = 0;

		await Promise.all(
			[1, 2, 3].map((value) =>
				limiter.schedule(async () => {
					concurrent += 1;
					maxConcurrent = Math.max(maxConcurrent, concurrent);
					await sleep(5);
					concurrent -= 1;
					return value;
				}),
			),
		);

		expect(maxConcurrent).toBe(1);
	});
});
