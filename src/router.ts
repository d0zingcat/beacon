import { Hono } from 'hono';
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from './config';
import { FEED_CACHE_CONTROL, FEED_CONTENT_TYPE, handleFeedRequest } from './feed/handler';
import { getSource, isStaticSource, listSources } from './sources/registry';
import { createDb } from './db/client';
import {
	deleteFeedSource,
	getItemById,
	getLatestState,
	getSourceRow,
	insertFeedSource,
	listItems,
	listRunLogs,
	listStatesByItemId,
	parseItemSortField,
	parseSortOrder,
	updateFeedSource,
} from './db/repo';
import { runSource } from './crawler/runner';
import { enqueueSource } from './scheduler';
import { ensureSourcesLoaded } from './sources/load-from-db';
import {
	serializeFeedSourceConfig,
	validateFeedSourceConfig,
	validateFeedSourceInput,
} from './sources/feed-config';

const app = new Hono<{ Bindings: Env }>();

app.use('*', async (c, next) => {
	if (c.req.path === '/health') {
		await next();
		return;
	}
	await ensureSourcesLoaded(c.env);
	await next();
});

app.get('/health', (c) => c.json({ ok: true, service: 'beacon' }));

app.get('/sources', (c) => {
	const sources = listSources().map((source) => ({
		id: source.id,
		name: source.name,
		kind: source.kind,
		mode: source.mode,
		schedule: source.schedule,
		managedInDb: source.kind === 'feed' && !isStaticSource(source.id),
	}));
	return c.json({ sources });
});

app.post('/sources', async (c) => {
	const body = await c.req.json().catch(() => null);
	const input = validateFeedSourceInput(body);
	if (!input) {
		return c.json({ error: 'Invalid feed source payload' }, 400);
	}
	if (isStaticSource(input.id) || getSource(input.id)) {
		return c.json({ error: 'Source id already exists' }, 409);
	}

	const db = createDb(c.env);
	const now = Date.now();
	try {
		await insertFeedSource(db, {
			id: input.id,
			name: input.name,
			mode: input.mode,
			schedule: input.schedule,
			configJson: serializeFeedSourceConfig(input.config),
			now,
		});
	} catch {
		return c.json({ error: 'Source id already exists' }, 409);
	}

	await ensureSourcesLoaded(c.env);
	return c.json({ created: true, sourceId: input.id }, 201);
});

app.patch('/sources/:id', async (c) => {
	const sourceId = c.req.param('id');
	if (isStaticSource(sourceId)) {
		return c.json({ error: 'Built-in source cannot be updated' }, 403);
	}

	const body = await c.req.json().catch(() => null);
	if (!body || typeof body !== 'object') {
		return c.json({ error: 'Invalid payload' }, 400);
	}

	const record = body as Record<string, unknown>;
	const update: {
		id: string;
		name?: string;
		schedule?: string;
		configJson?: string;
	} = { id: sourceId };

	if (record.name !== undefined) {
		if (typeof record.name !== 'string' || record.name.trim().length === 0) {
			return c.json({ error: 'Invalid name' }, 400);
		}
		update.name = record.name.trim();
	}
	if (record.schedule !== undefined) {
		if (typeof record.schedule !== 'string' || record.schedule.trim().length === 0) {
			return c.json({ error: 'Invalid schedule' }, 400);
		}
		update.schedule = record.schedule.trim();
	}
	if (record.config !== undefined) {
		const config = validateFeedSourceConfig(record.config);
		if (!config) {
			return c.json({ error: 'Invalid feed config' }, 400);
		}
		update.configJson = serializeFeedSourceConfig(config);
	}
	if (update.name === undefined && update.schedule === undefined && update.configJson === undefined) {
		return c.json({ error: 'No fields to update' }, 400);
	}

	const db = createDb(c.env);
	const updated = await updateFeedSource(db, update);
	if (!updated) {
		return c.json({ error: 'Feed source not found' }, 404);
	}

	await ensureSourcesLoaded(c.env);
	return c.json({ updated: true, sourceId });
});

app.delete('/sources/:id', async (c) => {
	const sourceId = c.req.param('id');
	if (isStaticSource(sourceId)) {
		return c.json({ error: 'Built-in source cannot be deleted' }, 403);
	}

	const db = createDb(c.env);
	const deleted = await deleteFeedSource(db, sourceId);
	if (!deleted) {
		return c.json({ error: 'Feed source not found' }, 404);
	}

	await ensureSourcesLoaded(c.env);
	return c.json({ deleted: true, sourceId });
});

app.get('/sources/:id', async (c) => {
	const sourceId = c.req.param('id');
	const source = getSource(sourceId);
	if (!source) {
		return c.json({ error: 'Source not found' }, 404);
	}

	const db = createDb(c.env);
	const row = await getSourceRow(db, sourceId);
	return c.json({
		source: {
			id: source.id,
			name: source.name,
			kind: source.kind,
			mode: source.mode,
			schedule: source.schedule,
			managedInDb: source.kind === 'feed' && !isStaticSource(source.id),
			config: row?.config_json ? JSON.parse(row.config_json) : null,
			lastRunAt: row?.last_run_at ?? null,
			lastStatus: row?.last_status ?? null,
		},
	});
});

app.get('/feed', async (c) => {
	const db = createDb(c.env);
	const limit = Math.min(
		Number(c.req.query('limit') ?? DEFAULT_PAGE_LIMIT),
		MAX_PAGE_LIMIT,
	);
	const result = await handleFeedRequest({
		reqUrl: c.req.url,
		sourceParam: c.req.query('source'),
		limit,
		sort: parseItemSortField(c.req.query('sort')),
		order: parseSortOrder(c.req.query('order')),
		getSource,
		listItems: (query) => listItems(db, query),
	});

	if (!result.ok) {
		return c.json(result.body, result.status);
	}

	return c.body(result.xml, 200, {
		'Content-Type': FEED_CONTENT_TYPE,
		'Cache-Control': FEED_CACHE_CONTROL,
	});
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
	const forceNotify = c.req.query('forceNotify') === '1' || c.req.query('forceNotify') === 'true';
	if (c.req.query('sync') === '1') {
		const result = await runSource(c.env, sourceId, { forceNotify });
		return c.json(result);
	}
	await enqueueSource(c.env, sourceId, { forceNotify });
	return c.json({ queued: true, sourceId, forceNotify });
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
