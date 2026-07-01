import { Hono } from 'hono';
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from './config';
import { listSources } from './sources/registry';
import { createDb } from './db/client';
import {
	getItemById,
	getLatestState,
	listItems,
	listRunLogs,
	listStatesByItemId,
	parseItemSortField,
	parseSortOrder,
} from './db/repo';
import { runSource } from './crawler/runner';
import { enqueueSource } from './scheduler';

const app = new Hono<{ Bindings: Env }>();

app.get('/health', (c) => c.json({ ok: true, service: 'beacon' }));

app.get('/sources', (c) => {
	const sources = listSources().map((source) => ({
		id: source.id,
		name: source.name,
		kind: source.kind,
		mode: source.mode,
		schedule: source.schedule,
	}));
	return c.json({ sources });
});

app.get('/items', async (c) => {
	const db = createDb(c.env);
	const sourceId = c.req.query('source');
	const mode = c.req.query('mode') as 'append' | 'state' | undefined;
	const limit = Math.min(
		Number(c.req.query('limit') ?? DEFAULT_PAGE_LIMIT),
		MAX_PAGE_LIMIT,
	);
	const cursor = c.req.query('cursor') ? Number(c.req.query('cursor')) : undefined;
	const sort = parseItemSortField(c.req.query('sort'));
	if (sort === null) {
		return c.json({ error: 'Invalid sort field', allowed: ['published_at', 'created_at', 'id', 'updated_at'] }, 400);
	}
	const order = parseSortOrder(c.req.query('order'));
	if (order === null) {
		return c.json({ error: 'Invalid order', allowed: ['asc', 'desc'] }, 400);
	}

	const items = await listItems(db, { sourceId, mode, limit, cursor, sort, order });
	return c.json({
		items,
		nextCursor: items.length === limit ? items[items.length - 1]?.id : null,
	});
});

app.get('/items/:id', async (c) => {
	const db = createDb(c.env);
	const id = Number(c.req.param('id'));
	const item = await getItemById(db, id);
	if (!item) {
		return c.json({ error: 'Item not found' }, 404);
	}
	return c.json({ item });
});

app.get('/items/:id/states', async (c) => {
	const db = createDb(c.env);
	const id = Number(c.req.param('id'));
	const limit = Math.min(
		Number(c.req.query('limit') ?? DEFAULT_PAGE_LIMIT),
		MAX_PAGE_LIMIT,
	);
	const item = await getItemById(db, id);
	if (!item) {
		return c.json({ error: 'Item not found' }, 404);
	}
	const states = await listStatesByItemId(db, id, limit);
	return c.json({ itemId: id, states });
});

app.get('/items/:id/states/latest', async (c) => {
	const db = createDb(c.env);
	const id = Number(c.req.param('id'));
	const item = await getItemById(db, id);
	if (!item) {
		return c.json({ error: 'Item not found' }, 404);
	}
	const state = await getLatestState(db, id);
	return c.json({ itemId: id, state });
});

app.post('/sources/:id/run', async (c) => {
	const sourceId = c.req.param('id');
	const exists = listSources().some((source) => source.id === sourceId);
	if (!exists) {
		return c.json({ error: 'Source not found' }, 404);
	}
	if (c.req.query('sync') === '1') {
		const result = await runSource(c.env, sourceId);
		return c.json(result);
	}
	await enqueueSource(c.env, sourceId);
	return c.json({ queued: true, sourceId });
});

app.get('/runs', async (c) => {
	const db = createDb(c.env);
	const sourceId = c.req.query('source');
	const limit = Math.min(
		Number(c.req.query('limit') ?? DEFAULT_PAGE_LIMIT),
		MAX_PAGE_LIMIT,
	);
	const runs = await listRunLogs(db, { sourceId, limit });
	return c.json({ runs });
});

export default app;
