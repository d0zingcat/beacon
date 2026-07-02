import type { ItemRow, ItemSortField, SortOrder } from '../db/repo';
import type { Source, SourceMode } from '../sources/types';
import { buildFeedChannel, buildFeedUrl, parseSourceIds, validateFeedSources } from './query';
import { mapItemRowToFeedItem, renderRssFeed } from './render';

export const FEED_CONTENT_TYPE = 'application/rss+xml; charset=utf-8';
export const FEED_CACHE_CONTROL = 'public, max-age=300';

export type FeedErrorBody = {
	error: string;
	sourceId?: string;
	allowed?: string[];
};

export type FeedErrorStatus = 400 | 404;

export type FeedHandlerResult =
	| { ok: true; xml: string }
	| { ok: false; status: FeedErrorStatus; body: FeedErrorBody };

export async function handleFeedRequest(input: {
	reqUrl: string;
	sourceParam?: string;
	limit: number;
	sort: ItemSortField | null;
	order: SortOrder | null;
	getSource: (id: string) => Source | undefined;
	listItems: (query: {
		sourceIds?: string[];
		mode?: SourceMode;
		limit: number;
		sort: ItemSortField;
		order: SortOrder;
	}) => Promise<ItemRow[]>;
}): Promise<FeedHandlerResult> {
	if (input.sort === null) {
		return {
			ok: false,
			status: 400,
			body: {
				error: 'Invalid sort field',
				allowed: ['published_at', 'created_at', 'id', 'updated_at'],
			},
		};
	}
	if (input.order === null) {
		return {
			ok: false,
			status: 400,
			body: { error: 'Invalid order', allowed: ['asc', 'desc'] },
		};
	}

	const sourceIds = parseSourceIds(input.sourceParam);
	const validation = validateFeedSources(sourceIds, input.getSource);
	if (!validation.ok) {
		return {
			ok: false,
			status: validation.status,
			body: {
				error: validation.error,
				sourceId: validation.sourceId,
			},
		};
	}

	const items = await input.listItems({
		sourceIds: validation.sourceIds,
		mode: 'append',
		limit: input.limit,
		sort: input.sort,
		order: input.order,
	});

	const feedUrl = buildFeedUrl(input.reqUrl, validation.sourceIds);
	const channel = buildFeedChannel(validation.sourceIds, feedUrl, input.getSource);
	const xml = renderRssFeed(channel, items.map(mapItemRowToFeedItem));

	return { ok: true, xml };
}
