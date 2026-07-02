import { createFeedExtractor } from '../extract/feed';
import { createDb, type Db } from '../db/client';
import { listFeedSourceRows, type SourceRow } from '../db/repo';
import { buildSource } from './factory';
import {
	DEFAULT_FEED_HEADERS,
	parseFeedSourceConfig,
	type FeedSourceConfig,
} from './feed-config';
import { clearDynamicSources, registerDynamicSource } from './registry';
import type { Source } from './types';

export function createFeedExtractorFromConfig(config: FeedSourceConfig) {
	return createFeedExtractor({
		feedUrl: config.feedUrl,
		headers: {
			...DEFAULT_FEED_HEADERS,
			...config.headers,
		},
	});
}

export function buildFeedSourceFromRow(row: SourceRow): Source | null {
	const config = parseFeedSourceConfig(row.config_json);
	if (!config || row.mode !== 'append') {
		return null;
	}
	return buildSource(
		{
			id: row.id,
			name: row.name,
			mode: 'append',
		},
		createFeedExtractorFromConfig(config),
	);
}

export async function loadFeedSourcesFromDb(db: Db): Promise<void> {
	const rows = await listFeedSourceRows(db);
	clearDynamicSources();
	for (const row of rows) {
		if (row.mode !== 'append') {
			continue;
		}
		const source = buildFeedSourceFromRow(row);
		if (source) {
			registerDynamicSource(source);
		}
	}
}

export async function ensureSourcesLoaded(env: Env): Promise<void> {
	try {
		await loadFeedSourcesFromDb(createDb(env));
	} catch (error) {
		console.error('Failed to load feed sources from DB:', error);
		clearDynamicSources();
	}
}
