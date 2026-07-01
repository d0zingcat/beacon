import type { RawItem } from '../sources/types';
import type { Extractor } from './types';

export interface WebpageExtractorConfig {
	url: string;
	headers?: Record<string, string>;
	parse: (html: string) => RawItem[];
}

export function createWebpageExtractor(config: WebpageExtractorConfig): Extractor {
	return {
		kind: 'webpage',
		async extract(ctx) {
			const response = await ctx.fetch(config.url, {
				headers: config.headers,
			});
			if (!response.ok) {
				throw new Error(`Webpage fetch failed: ${response.status} ${response.statusText}`);
			}
			return config.parse(await response.text());
		},
	};
}
