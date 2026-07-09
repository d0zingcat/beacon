import { describe, expect, it } from 'vitest';
import type { ItemRow } from '../db/repo';
import type { Source } from '../sources/types';
import { createPublicWebRoutes } from './public';

const SOURCE: Source = {
	id: 'cursor-blog',
	name: 'Cursor Blog',
	kind: 'webpage',
	mode: 'append',
	fetch: async () => [],
};

const STATE_SOURCE: Source = {
	id: 'dmit-stock',
	name: 'DMIT VPS Stock',
	kind: 'webpage',
	mode: 'state',
	fetch: async () => [],
};

const ITEM: ItemRow = {
	id: 42,
	source_id: 'cursor-blog',
	external_id: 'post-42',
	title: 'Cursor on iOS',
	url: 'https://cursor.com/blog/ios-mobile-app',
	summary: 'Native app public beta.',
	content: null,
	published_at: Date.parse('2026-06-30T00:00:00.000Z'),
	hash: 'hash',
	raw_json: null,
	notified: 0,
	state_json: null,
	prev_state_json: null,
	state_changed_at: null,
	updated_at: Date.parse('2026-06-30T00:00:00.000Z'),
	created_at: Date.parse('2026-06-30T00:00:00.000Z'),
};

describe('public web routes', () => {
	it('renders the anonymous home item stream', async () => {
		const app = createPublicWebRoutes({
			listPublicSources: () => [SOURCE],
			listPublicItems: async () => [ITEM],
		});

		const response = await app.request('/');
		const body = await response.text();

		expect(response.status).toBe(200);
		expect(body).toContain('Beacon');
		expect(body).toContain('Cursor on iOS');
		expect(body).toContain('Native app public beta.');
		expect(body).toContain('/browse/items/42');
	});

	it('renders the public source directory', async () => {
		const app = createPublicWebRoutes({
			listPublicSources: () => [SOURCE, STATE_SOURCE],
			listPublicItems: async () => [],
		});

		const response = await app.request('/browse/sources');
		const body = await response.text();

		expect(response.status).toBe(200);
		expect(body).toContain('Cursor Blog');
		expect(body).toContain('DMIT VPS Stock');
		expect(body).toContain('state');
	});

	it('renders a source detail page with recent items', async () => {
		const app = createPublicWebRoutes({
			listPublicSources: () => [SOURCE],
			listPublicItems: async (query) => (query.sourceId === 'cursor-blog' ? [ITEM] : []),
		});

		const response = await app.request('/browse/sources/cursor-blog');
		const body = await response.text();

		expect(response.status).toBe(200);
		expect(body).toContain('Cursor Blog');
		expect(body).toContain('Cursor on iOS');
		expect(body).toContain('https://cursor.com/blog/ios-mobile-app');
	});
});
