import { createWebpageExtractor } from '../../extract/webpage';
import { createSource } from '../factory';
import type { RawItem } from '../types';

const NEWS_URL = 'https://www.anthropic.com/news';
const BASE_URL = 'https://www.anthropic.com';

export function parseAnthropicNewsHtml(html: string): RawItem[] {
	const bySlug = new Map<string, RawItem>();

	for (const item of parsePublicationListItems(html)) {
		bySlug.set(item.externalId, item);
	}

	for (const item of parseFeaturedGridItems(html)) {
		const existing = bySlug.get(item.externalId);
		if (existing) {
			bySlug.set(item.externalId, {
				...existing,
				summary: existing.summary ?? item.summary,
			});
			continue;
		}
		bySlug.set(item.externalId, item);
	}

	return [...bySlug.values()];
}

function parsePublicationListItems(html: string): RawItem[] {
	const items: RawItem[] = [];
	const seen = new Set<string>();
	const blocks =
		html.match(/<a href="([^"]+)" class="[^"]*__listItem"[^>]*>[\s\S]*?<\/a>/gi) ?? [];

	for (const block of blocks) {
		const item = parseNewsBlock(block, {
			pathPattern: /href="([^"]+)"/,
			titlePattern: /<span class="[^"]*__title[^"]*"[^>]*>([\s\S]*?)<\/span>/i,
		});
		if (!item || seen.has(item.externalId)) continue;
		seen.add(item.externalId);
		items.push(item);
	}

	return items;
}

function parseFeaturedGridItems(html: string): RawItem[] {
	const items: RawItem[] = [];
	const seen = new Set<string>();
	const blocks = [
		...(html.match(/<a href="([^"]+)" class="[^"]*__content"[^>]*>[\s\S]*?<\/a>/gi) ?? []),
		...(html.match(/<a href="([^"]+)" class="[^"]*__sideLink[^"]*"[^>]*>[\s\S]*?<\/a>/gi) ?? []),
	];

	for (const block of blocks) {
		const item = parseNewsBlock(block, {
			pathPattern: /href="([^"]+)"/,
			titlePattern:
				/<h[24] class="[^"]*(?:__featuredTitle|__title)[^"]*"[^>]*>([\s\S]*?)<\/h[24]>/i,
			summaryPattern: /<p class="[^"]*__body[^"]*"[^>]*>([\s\S]*?)<\/p>/i,
		});
		if (!item || seen.has(item.externalId)) continue;
		seen.add(item.externalId);
		items.push(item);
	}

	return items;
}

function parseNewsBlock(
	block: string,
	patterns: {
		pathPattern: RegExp;
		titlePattern: RegExp;
		summaryPattern?: RegExp;
	},
): RawItem | null {
	const pathMatch = block.match(patterns.pathPattern);
	if (!pathMatch) return null;

	const path = pathMatch[1];
	const slug = pathToSlug(path);
	if (!slug) return null;

	const titleMatch = block.match(patterns.titlePattern);
	const title = titleMatch ? stripHtml(titleMatch[1]).trim() : slug;
	if (!title) return null;

	const dateTimeMatch = block.match(/dateTime="([^"]+)"/i);
	const dateMatch = block.match(
		/<time[^>]*>([\s\S]*?)<\/time>/i,
	);
	const summaryMatch = patterns.summaryPattern ? block.match(patterns.summaryPattern) : null;

	const publishedAt = dateTimeMatch
		? new Date(dateTimeMatch[1]).toISOString()
		: dateMatch
			? new Date(stripHtml(dateMatch[1]).trim()).toISOString()
			: undefined;

	return {
		externalId: slug,
		url: `${BASE_URL}${path}`,
		title,
		summary: summaryMatch ? stripHtml(summaryMatch[1]).trim() : undefined,
		publishedAt,
	};
}

function pathToSlug(path: string): string | null {
	const newsMatch = path.match(/^\/news\/([a-z0-9-]+)$/);
	if (newsMatch) return newsMatch[1];

	const rootMatch = path.match(/^\/([a-z][a-z0-9-]+)$/);
	if (!rootMatch) return null;

	const excluded = new Set([
		'careers',
		'company',
		'constitution',
		'economic-futures',
		'engineering',
		'events',
		'learn',
		'news',
		'policy',
		'research',
		'transparency',
	]);
	if (excluded.has(rootMatch[1])) return null;

	return rootMatch[1];
}

function stripHtml(value: string): string {
	return decodeHtml(value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '));
}

function decodeHtml(value: string): string {
	return value
		.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&#x27;/g, "'")
		.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

createSource(
	{
		id: 'anthropic-blog',
		name: 'Anthropic Blog',
		mode: 'append',
		schedule: '0 * * * *',
	},
	createWebpageExtractor({
		url: NEWS_URL,
		headers: {
			'user-agent': 'beacon/1.0 (+https://github.com/d0zingcat/beacon)',
			accept: 'text/html',
		},
		parse: (html, _ctx) => parseAnthropicNewsHtml(html),
	}),
);
