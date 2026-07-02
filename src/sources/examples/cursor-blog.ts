import { createWebpageExtractor } from '../../extract/webpage';
import { createSource } from '../factory';
import type { RawItem } from '../types';

const BLOG_URL = 'https://cursor.com/blog';
const BLOG_POST_PATH = /^\/blog\/([a-z0-9-]+)$/;

export function parseCursorBlogHtml(html: string): RawItem[] {
	const bySlug = new Map<string, RawItem>();

	for (const item of parseBlogDirectoryRows(html)) {
		bySlug.set(item.externalId, item);
	}

	for (const item of parseBlogCardArticles(html)) {
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

function parseBlogDirectoryRows(html: string): RawItem[] {
	const items: RawItem[] = [];
	const seen = new Set<string>();
	const blocks =
		html.match(/<a class="blog-directory__row[^"]*" href="(\/blog\/[^"]+)">[\s\S]*?<\/a>/gi) ??
		[];

	for (const block of blocks) {
		const item = parseBlogBlock(block, {
			pathPattern: /href="(\/blog\/[^"]+)"/,
			titlePattern:
				/<p class="[^"]*text-theme-text text-pretty[^"]*"[^>]*>([\s\S]*?)<\/p>/i,
		});
		if (!item || seen.has(item.externalId)) continue;
		seen.add(item.externalId);
		items.push(item);
	}

	return items;
}

function parseBlogCardArticles(html: string): RawItem[] {
	const items: RawItem[] = [];
	const seen = new Set<string>();
	const blocks =
		html.match(
			/<article class="h-full">\s*<a class="card[^"]*" href="(\/blog\/[^"]+)">[\s\S]*?<\/a>\s*<\/article>/gi,
		) ?? [];

	for (const block of blocks) {
		const item = parseBlogBlock(block, {
			pathPattern: /href="(\/blog\/[^"]+)"/,
			titlePattern:
				/<p class="[^"]*(?:type-md(?:-lg)?|text-theme-text text-pretty)[^"]*"[^>]*>([\s\S]*?)<\/p>/i,
			summaryPattern:
				/<p class="[^"]*text-theme-text-sec[^"]*"[^>]*>([\s\S]*?)<\/p>/i,
			fallbackTitlePattern: /<img[^>]*alt="([^"]+)"/i,
		});
		if (!item || seen.has(item.externalId)) continue;
		seen.add(item.externalId);
		items.push(item);
	}

	return items;
}

function parseBlogBlock(
	block: string,
	patterns: {
		pathPattern: RegExp;
		titlePattern: RegExp;
		summaryPattern?: RegExp;
		fallbackTitlePattern?: RegExp;
	},
): RawItem | null {
	const pathMatch = block.match(patterns.pathPattern);
	if (!pathMatch) return null;

	const path = pathMatch[1];
	const slugMatch = path.match(BLOG_POST_PATH);
	if (!slugMatch) return null;

	const slug = slugMatch[1];
	const titleMatch = block.match(patterns.titlePattern);
	const fallbackTitleMatch = patterns.fallbackTitlePattern
		? block.match(patterns.fallbackTitlePattern)
		: null;
	const titleSource = titleMatch?.[1] ?? fallbackTitleMatch?.[1];
	const title = titleSource ? stripHtml(titleSource).trim() : slug;
	if (!title) return null;

	const dateTimeMatch = block.match(/dateTime="([^"]+)"/i);
	const summaryMatch = patterns.summaryPattern ? block.match(patterns.summaryPattern) : null;

	return {
		externalId: slug,
		url: `https://cursor.com${path}`,
		title,
		summary: summaryMatch ? stripHtml(summaryMatch[1]).trim() : undefined,
		publishedAt: dateTimeMatch ? new Date(dateTimeMatch[1]).toISOString() : undefined,
	};
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
		id: 'cursor-blog',
		name: 'Cursor Blog',
		mode: 'append',
	},
	createWebpageExtractor({
		url: BLOG_URL,
		headers: {
			'user-agent': 'beacon/1.0 (+https://github.com/d0zingcat/beacon)',
			accept: 'text/html',
		},
		parse: (html, _ctx) => parseCursorBlogHtml(html),
	}),
);
