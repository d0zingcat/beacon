import type { SourceKind, SourceMode } from '../sources/types';
import type { Db } from './client';

export interface SourceRow extends Record<string, unknown> {
	id: string;
	name: string;
	kind: SourceKind;
	mode: SourceMode;
	config_json: string | null;
	last_run_at: number | null;
	last_status: string | null;
	created_at: number;
}

export interface ItemRow extends Record<string, unknown> {
	id: number;
	source_id: string;
	external_id: string;
	title: string;
	url: string | null;
	summary: string | null;
	content: string | null;
	published_at: number | null;
	hash: string;
	raw_json: string | null;
	notified: number;
	state_json: string | null;
	prev_state_json: string | null;
	state_changed_at: number | null;
	updated_at: number;
	created_at: number;
}

export interface StateRow extends Record<string, unknown> {
	id: number;
	item_id: number;
	source_id: string;
	observed_at: number;
	state_json: string;
	changed: number;
	diff_json: string | null;
}

export interface RunLogRow extends Record<string, unknown> {
	id: number;
	source_id: string;
	started_at: number;
	finished_at: number | null;
	status: string | null;
	error: string | null;
	items_new: number;
	items_total: number;
	state_changes: number;
}

export interface InsertItemInput {
	sourceId: string;
	externalId: string;
	title: string;
	url?: string;
	summary?: string;
	content?: string;
	publishedAt?: number;
	hash: string;
	rawJson?: string;
	stateJson?: string;
	now: number;
}

export async function upsertSource(
	db: Db,
	input: {
		id: string;
		name: string;
		kind: SourceKind;
		mode: SourceMode;
		configJson?: string;
		now: number;
	},
): Promise<void> {
	await db.run(
		`INSERT INTO sources (id, name, kind, mode, config_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       kind = excluded.kind,
       mode = excluded.mode,
       config_json = excluded.config_json`,
		input.id,
		input.name,
		input.kind,
		input.mode,
		input.configJson ?? null,
		input.now,
	);
}

export async function updateSourceRunStatus(
	db: Db,
	sourceId: string,
	status: string,
	now: number,
): Promise<void> {
	await db.run(
		`UPDATE sources SET last_run_at = ?, last_status = ? WHERE id = ?`,
		now,
		status,
		sourceId,
	);
}

export async function hasItemByHash(db: Db, sourceId: string, hash: string): Promise<boolean> {
	const row = await db.first<{ id: number }>(
		`SELECT id FROM items WHERE source_id = ? AND hash = ? LIMIT 1`,
		sourceId,
		hash,
	);
	return row !== null;
}

export async function getItemByExternalId(
	db: Db,
	sourceId: string,
	externalId: string,
): Promise<ItemRow | null> {
	return db.first<ItemRow>(
		`SELECT * FROM items WHERE source_id = ? AND external_id = ? LIMIT 1`,
		sourceId,
		externalId,
	);
}

export async function insertItem(db: Db, input: InsertItemInput): Promise<number> {
	const result = await db.run(
		`INSERT INTO items (
      source_id, external_id, title, url, summary, content, published_at,
      hash, raw_json, state_json, updated_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		input.sourceId,
		input.externalId,
		input.title,
		input.url ?? null,
		input.summary ?? null,
		input.content ?? null,
		input.publishedAt ?? null,
		input.hash,
		input.rawJson ?? null,
		input.stateJson ?? null,
		input.now,
		input.now,
	);
	return Number(result.meta.last_row_id);
}

export async function updateItemState(
	db: Db,
	input: {
		itemId: number;
		stateJson: string;
		prevStateJson: string | null;
		now: number;
	},
): Promise<void> {
	await db.run(
		`UPDATE items SET
      state_json = ?,
      prev_state_json = ?,
      state_changed_at = ?,
      updated_at = ?
     WHERE id = ?`,
		input.stateJson,
		input.prevStateJson,
		input.now,
		input.now,
		input.itemId,
	);
}

export async function markItemNotified(db: Db, itemId: number): Promise<void> {
	await db.run(`UPDATE items SET notified = 1 WHERE id = ?`, itemId);
}

export async function insertState(
	db: Db,
	input: {
		itemId: number;
		sourceId: string;
		observedAt: number;
		stateJson: string;
		changed: boolean;
		diffJson?: string;
	},
): Promise<number> {
	const result = await db.run(
		`INSERT INTO states (item_id, source_id, observed_at, state_json, changed, diff_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
		input.itemId,
		input.sourceId,
		input.observedAt,
		input.stateJson,
		input.changed ? 1 : 0,
		input.diffJson ?? null,
	);
	return Number(result.meta.last_row_id);
}

export async function getLatestState(db: Db, itemId: number): Promise<StateRow | null> {
	return db.first<StateRow>(
		`SELECT * FROM states WHERE item_id = ? ORDER BY observed_at DESC LIMIT 1`,
		itemId,
	);
}

export async function listStatesByItemId(db: Db, itemId: number, limit: number): Promise<StateRow[]> {
	return db.all<StateRow>(
		`SELECT * FROM states WHERE item_id = ? ORDER BY observed_at DESC LIMIT ?`,
		itemId,
		limit,
	);
}

export const ITEM_SORT_FIELDS = ['published_at', 'created_at', 'id', 'updated_at'] as const;
export type ItemSortField = (typeof ITEM_SORT_FIELDS)[number];
export type SortOrder = 'asc' | 'desc';

const ITEM_SORT_SQL: Record<ItemSortField, string> = {
	published_at: 'COALESCE(i.published_at, i.created_at)',
	created_at: 'i.created_at',
	id: 'i.id',
	updated_at: 'i.updated_at',
};

export function parseItemSortField(value: string | undefined): ItemSortField | null {
	if (!value) {
		return 'published_at';
	}
	return (ITEM_SORT_FIELDS as readonly string[]).includes(value) ? (value as ItemSortField) : null;
}

export function parseSortOrder(value: string | undefined): SortOrder | null {
	if (!value) {
		return 'desc';
	}
	return value === 'asc' || value === 'desc' ? value : null;
}

function getItemSortValue(item: ItemRow, field: ItemSortField): number {
	switch (field) {
		case 'published_at':
			return item.published_at ?? item.created_at;
		case 'created_at':
			return item.created_at;
		case 'id':
			return item.id;
		case 'updated_at':
			return item.updated_at;
	}
}

export async function listItems(
	db: Db,
	input: {
		sourceId?: string;
		mode?: SourceMode;
		limit: number;
		cursor?: number;
		sort?: ItemSortField;
		order?: SortOrder;
	},
): Promise<ItemRow[]> {
	const sort = input.sort ?? 'published_at';
	const order = input.order ?? 'desc';
	const sortExpr = ITEM_SORT_SQL[sort];
	const orderDir = order === 'asc' ? 'ASC' : 'DESC';
	const params: unknown[] = [];
	const clauses: string[] = [];

	if (input.sourceId) {
		clauses.push('i.source_id = ?');
		params.push(input.sourceId);
	}
	if (input.mode) {
		clauses.push('s.mode = ?');
		params.push(input.mode);
	}
	if (input.cursor) {
		const cursorItem = await getItemById(db, input.cursor);
		if (cursorItem) {
			const op = order === 'desc' ? '<' : '>';
			clauses.push(`(${sortExpr}, i.id) ${op} (?, ?)`);
			params.push(getItemSortValue(cursorItem, sort), cursorItem.id);
		}
	}

	const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
	params.push(input.limit);

	return db.all<ItemRow>(
		`SELECT i.* FROM items i
     JOIN sources s ON s.id = i.source_id
     ${where}
     ORDER BY ${sortExpr} ${orderDir}, i.id ${orderDir}
     LIMIT ?`,
		...params,
	);
}

export async function getItemById(db: Db, id: number): Promise<ItemRow | null> {
	return db.first<ItemRow>(`SELECT * FROM items WHERE id = ? LIMIT 1`, id);
}

export async function startRunLog(db: Db, sourceId: string, startedAt: number): Promise<number> {
	const result = await db.run(
		`INSERT INTO run_log (source_id, started_at, status) VALUES (?, ?, 'running')`,
		sourceId,
		startedAt,
	);
	return Number(result.meta.last_row_id);
}

export async function finishRunLog(
	db: Db,
	input: {
		runId: number;
		status: string;
		error?: string;
		itemsNew: number;
		itemsTotal: number;
		stateChanges: number;
		finishedAt: number;
	},
): Promise<void> {
	await db.run(
		`UPDATE run_log SET
      finished_at = ?,
      status = ?,
      error = ?,
      items_new = ?,
      items_total = ?,
      state_changes = ?
     WHERE id = ?`,
		input.finishedAt,
		input.status,
		input.error ?? null,
		input.itemsNew,
		input.itemsTotal,
		input.stateChanges,
		input.runId,
	);
}

export async function listRunLogs(
	db: Db,
	input: { sourceId?: string; limit: number },
): Promise<RunLogRow[]> {
	if (input.sourceId) {
		return db.all<RunLogRow>(
			`SELECT * FROM run_log WHERE source_id = ? ORDER BY id DESC LIMIT ?`,
			input.sourceId,
			input.limit,
		);
	}
	return db.all<RunLogRow>(`SELECT * FROM run_log ORDER BY id DESC LIMIT ?`, input.limit);
}
