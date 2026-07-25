import type { RawItem } from '../sources/types';
import type { Extractor } from './types';

export type FeedExternalIdMode = 'guid' | 'stable';

export interface ParseRssFeedOptions {
	/** `guid` (default) uses RSS guid; `stable` includes link/title/summary to avoid colliding guids. */
	externalIdMode?: FeedExternalIdMode;
}

export interface FeedExtractorConfig {
	feedUrl: string;
	headers?: Record<string, string>;
	parse?: (xml: string) => RawItem[];
	externalIdMode?: FeedExternalIdMode;
}

export function createFeedExtractor(config: FeedExtractorConfig): Extractor {
	const parse =
		config.parse ?? ((xml: string) => parseRssFeed(xml, { externalIdMode: config.externalIdMode }));
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

export function buildRssExternalId(
	input: {
		guid: string;
		link?: string;
		title: string;
		summary?: string;
	},
	mode: FeedExternalIdMode = 'guid',
): string {
	if (mode === 'guid') {
		return input.guid;
	}
	return [input.guid, input.link ?? '', input.title, input.summary ?? ''].join('\n');
}

export function parseRssFeed(xml: string, options: ParseRssFeedOptions = {}): RawItem[] {
	const mode = options.externalIdMode ?? 'guid';
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
			externalId: buildRssExternalId(
				{ guid, link, title, summary: description },
				mode,
			),
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
