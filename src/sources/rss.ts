import type { RawItem, Source, SourceContext } from './types';
import { registerSource } from './registry';

export interface RssSourceConfig {
	feedUrl: string;
}

export function createRssSource(
	base: Omit<Source, 'fetch' | 'kind' | 'mode'> & { mode?: Source['mode'] },
	config: RssSourceConfig,
	fetchItems?: (ctx: SourceContext, config: RssSourceConfig) => Promise<RawItem[]>,
): Source {
	const source: Source = {
		...base,
		kind: 'rss',
		mode: base.mode ?? 'append',
		async fetch(ctx) {
			if (fetchItems) {
				return fetchItems(ctx, config);
			}
			const response = await ctx.fetch(config.feedUrl);
			if (!response.ok) {
				throw new Error(`RSS fetch failed: ${response.status} ${response.statusText}`);
			}
			const text = await response.text();
			return parseRssFeed(text);
		},
	};
	registerSource(source);
	return source;
}

function parseRssFeed(xml: string): RawItem[] {
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
