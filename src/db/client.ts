export type DbRow = Record<string, unknown>;

export class Db {
	constructor(private readonly db: D1Database) {}

	async run(sql: string, ...params: unknown[]): Promise<D1Result> {
		return this.db.prepare(sql).bind(...params).run();
	}

	async first<T extends DbRow = DbRow>(sql: string, ...params: unknown[]): Promise<T | null> {
		return this.db.prepare(sql).bind(...params).first<T>();
	}

	async all<T extends DbRow = DbRow>(sql: string, ...params: unknown[]): Promise<T[]> {
		const result = await this.db.prepare(sql).bind(...params).all<T>();
		return result.results ?? [];
	}
}

export function createDb(env: Env): Db {
	return new Db(env.DB);
}
