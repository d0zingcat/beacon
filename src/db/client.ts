export type DbRow = Record<string, unknown>;

const DEFAULT_D1_RETRIES = 2;

export function isRetryableD1Error(error: unknown): boolean {
	const message = error instanceof Error ? error.message : String(error);
	return (
		message.includes('Network connection lost') ||
		message.includes('storage caused object to be reset')
	);
}

export function d1RetryDelayMs(attempt: number): number {
	return Math.min(100 * 2 ** attempt, 500);
}

async function withD1Retry<T>(
	operation: () => Promise<T>,
	options: {
		retries?: number;
		delayMs?: (attempt: number) => number;
		sleep?: (ms: number) => Promise<void>;
	} = {},
): Promise<T> {
	const retries = options.retries ?? DEFAULT_D1_RETRIES;
	const delayMs = options.delayMs ?? d1RetryDelayMs;
	const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));

	let lastError: unknown;
	for (let attempt = 0; attempt <= retries; attempt++) {
		try {
			return await operation();
		} catch (error) {
			lastError = error;
			if (!isRetryableD1Error(error) || attempt === retries) {
				throw error;
			}
			await sleep(delayMs(attempt));
		}
	}
	throw lastError ?? new Error('D1 operation failed');
}

export class Db {
	constructor(private readonly db: D1Database) {}

	async run(sql: string, ...params: unknown[]): Promise<D1Result> {
		return withD1Retry(() => this.db.prepare(sql).bind(...params).run());
	}

	async first<T extends DbRow = DbRow>(sql: string, ...params: unknown[]): Promise<T | null> {
		return withD1Retry(() => this.db.prepare(sql).bind(...params).first<T>());
	}

	async all<T extends DbRow = DbRow>(sql: string, ...params: unknown[]): Promise<T[]> {
		return withD1Retry(async () => {
			const result = await this.db.prepare(sql).bind(...params).all<T>();
			return result.results ?? [];
		});
	}
}

export function createDb(env: Env): Db {
	return new Db(env.DB);
}

export { withD1Retry };
