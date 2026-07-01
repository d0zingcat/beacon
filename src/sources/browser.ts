import { createBrowserExtractor, withBrowserPage } from '../extract/browser';
import type { Extractor } from '../extract/types';
import { createSource } from './factory';
import type { RawItem, Source, SourceContext } from './types';

export { withBrowserPage } from '../extract/browser';

export interface BrowserSourceConfig {
	url: string;
}

/** @deprecated Use createSource with createBrowserExtractor */
export function createBrowserSource(
	base: Omit<Source, 'fetch' | 'kind'> & { mode: Source['mode'] },
	config: BrowserSourceConfig,
	fetchItems: (ctx: SourceContext, config: BrowserSourceConfig) => Promise<RawItem[]>,
): Source {
	const extractor: Extractor = {
		kind: 'browser',
		async extract(ctx) {
			if (!ctx.browser) {
				throw new Error('Browser binding is not available');
			}
			return fetchItems(ctx, config);
		},
	};
	return createSource(base, extractor);
}

export { createBrowserExtractor };
