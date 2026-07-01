import type { RawItem } from '../sources/types';
import type { Extractor } from './types';

export interface FeedExtractorConfig {
	feedUrl: string;
	headers?: Record<string, string>;
	parse?: (xml: string) => RawItem[];
}

export function createFeedExtractor(config: FeedExtractorConfig): Extractor {
	const parse = config.parse ?? parseRssFeed;
	return {
		kind: 'feed',
		async extract(ctx) {
			const response = await ctx.fetch(config.feedUrl, {
				headers: config.headers,
			});
			if (!response.ok) {
				throw new Error(`RSS fetch failed: ${response.status} ${response.statusText}`);
			}
			return parse(await response.text());
		},
	};
}

export function parseRssFeed(xml: string): RawItem[] {
	const items: RawItem[] = [];
	const itemBlocks = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];
	for (const block of itemBlocks) {
		const title = extractTag(block, 'title');
		const link = extractTag(block, 'link');
		const guid = extractTag(block, 'guid') ?? link;
		const description = extractTag(block, 'description');
		const pubDate = extractTag(block, 'pubDate');
		if (!title || !guid) continue;
		items.push({
			externalId: guid,
			url: link ?? '',
			title,
			summary: description,
			publishedAt: pubDate ? new Date(pubDate).toISOString() : undefined,
		});
	}
	return items;
}

function extractTag(block: string, tag: string): string | undefined {
	const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
	if (!match) return undefined;
	return decodeXml(match[1].trim());
}

function decodeXml(value: string): string {
	return value
		.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'");
}
