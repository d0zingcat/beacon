import { Hono } from 'hono';
import { DEFAULT_PAGE_LIMIT } from '../config';
import { createDb } from '../db/client';
import { listItems, type ItemRow } from '../db/repo';
import { getSource, listSources } from '../sources/registry';
import type { Source } from '../sources/types';
import { escapeHtml, page } from './render';

export interface PublicWebDeps {
	listPublicSources?: () => Source[];
	listPublicItems?: (query: { sourceId?: string; limit: number }, env?: Env) => Promise<ItemRow[]>;
}

function formatDate(value: number | null): string {
	if (!value) return '';
	return new Date(value).toISOString().slice(0, 10);
}

function renderItem(item: ItemRow, source?: Source): string {
	const href = item.url ? escapeHtml(item.url) : `/browse/items/${item.id}`;
	const summary = item.summary ? `<p class="summary">${escapeHtml(item.summary)}</p>` : '';
	return `<article class="item">
<div class="meta">${escapeHtml(source?.name ?? item.source_id)} · ${escapeHtml(formatDate(item.published_at ?? item.created_at))}</div>
<h2><a href="/browse/items/${item.id}">${escapeHtml(item.title)}</a></h2>
${summary}
<p><a href="${href}">Open original</a></p>
</article>`;
}

function renderSource(source: Source): string {
	return `<article class="source">
<h2><a href="/browse/sources/${encodeURIComponent(source.id)}">${escapeHtml(source.name)}</a></h2>
<p class="meta">${escapeHtml(source.id)} · ${escapeHtml(source.mode)} · ${escapeHtml(source.kind)}</p>
</article>`;
}

export function createPublicWebRoutes(deps: PublicWebDeps = {}): Hono<{ Bindings: Env }> {
	const app = new Hono<{ Bindings: Env }>();
	const getSources = deps.listPublicSources ?? listSources;
	const getItems =
		deps.listPublicItems ??
		(async ({ sourceId, limit }, env?: Env) =>
			listItems(createDb(env!), {
				sourceId,
				limit,
				sort: 'published_at',
				order: 'desc',
			}));

	app.get('/', async (c) => {
		const sources = getSources();
		const sourceId = c.req.query('source');
		const items = await getItems({ sourceId, limit: DEFAULT_PAGE_LIMIT }, c.env);
		const byId = new Map(sources.map((source) => [source.id, source]));
		const filters = sources
			.map((source) => `<a class="pill" href="/?source=${encodeURIComponent(source.id)}">${escapeHtml(source.name)}</a>`)
			.join('');
		return c.html(
			page(
				'Beacon',
				`<section class="panel"><h1>Beacon</h1><p>Latest updates from supported sources.</p><div class="toolbar"><a class="pill" href="/">All</a>${filters}</div></section><section>${items.map((item) => renderItem(item, byId.get(item.source_id))).join('')}</section>`,
			),
		);
	});

	app.get('/browse/sources', (c) => {
		const sources = getSources();
		return c.html(
			page(
				'Beacon sources',
				`<h1>Sources</h1><section class="grid">${sources.map(renderSource).join('')}</section>`,
			),
		);
	});

	app.get('/browse/sources/:id', async (c) => {
		const sourceId = c.req.param('id');
		const source = getSources().find((item) => item.id === sourceId) ?? getSource(sourceId);
		if (!source) {
			return c.html(page('Source not found', '<h1>Source not found</h1>'), 404);
		}
		const items = await getItems({ sourceId, limit: DEFAULT_PAGE_LIMIT }, c.env);
		return c.html(
			page(
				source.name,
				`<section class="panel"><h1>${escapeHtml(source.name)}</h1><p class="meta">${escapeHtml(source.id)} · ${escapeHtml(source.mode)} · ${escapeHtml(source.kind)}</p><p><a href="/feed?source=${encodeURIComponent(source.id)}">RSS feed</a></p></section><section>${items.map((item) => renderItem(item, source)).join('')}</section>`,
			),
		);
	});

	app.get('/browse/items/:id', async (c) => {
		const id = Number(c.req.param('id'));
		if (!Number.isFinite(id)) {
			return c.html(page('Item not found', '<h1>Item not found</h1>'), 404);
		}
		const db = createDb(c.env);
		const { getItemById } = await import('../db/repo');
		const item = await getItemById(db, id);
		if (!item) {
			return c.html(page('Item not found', '<h1>Item not found</h1>'), 404);
		}
		const source = getSource(item.source_id);
		return c.html(page(item.title, renderItem(item, source)));
	});

	return app;
}
