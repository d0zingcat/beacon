import { createFeedExtractor } from '../extract/feed';
import type { Extractor } from '../extract/types';
import { createSource } from './factory';
import type { RawItem, Source, SourceContext } from './types';

export { parseRssFeed } from '../extract/feed';

export interface RssSourceConfig {
	feedUrl: string;
}

/** @deprecated Use createSource with createFeedExtractor */
export function createRssSource(
	base: Omit<Source, 'fetch' | 'kind' | 'mode'> & { mode?: Source['mode'] },
	config: RssSourceConfig,
	fetchItems?: (ctx: SourceContext, config: RssSourceConfig) => Promise<RawItem[]>,
): Source {
	const extractor: Extractor = fetchItems
		? {
				kind: 'feed',
				extract: (ctx) => fetchItems(ctx, config),
			}
		: createFeedExtractor({ feedUrl: config.feedUrl });
	return createSource({ ...base, mode: base.mode ?? 'append' }, extractor);
}
