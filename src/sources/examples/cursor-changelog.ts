import { createWebpageExtractor } from '../../extract/webpage';
import { createSource } from '../factory';
import type { RawItem } from '../types';

const CHANGELOG_URL = 'https://cursor.com/changelog';

export function parseCursorChangelogHtml(html: string): RawItem[] {
	const items: RawItem[] = [];
	const seen = new Set<string>();
	const articles = html.match(/<article[\s\S]*?<\/article>/gi) ?? [];

	for (const block of articles) {
		const linkMatch = block.match(
			/<h[12][^>]*>[\s\S]*?<a[^>]*href="(\/changelog\/[^"]+)"/i,
		);
		if (!linkMatch) continue;

		const path = linkMatch[1];
		const slug = path.replace(/^\/changelog\//, '');
		if (!slug || slug.startsWith('page/') || seen.has(slug)) continue;
		seen.add(slug);

		const titleMatch = block.match(/<h[12][^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i);
		const title = titleMatch ? stripHtml(titleMatch[1]).trim() : slug;
		if (!title) continue;

		const dateTimeMatch = block.match(/dateTime="([^"]+)"/i);
		const dateMatch = block.match(
			/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}, \d{4}\b/,
		);
		const summaryMatch = block.match(
			/<div class="prose[^"]*"[^>]*>[\s\S]*?<p>([\s\S]*?)<\/p>/i,
		);

		const publishedAt = dateTimeMatch
			? new Date(dateTimeMatch[1]).toISOString()
			: dateMatch
				? new Date(dateMatch[0]).toISOString()
				: undefined;

		items.push({
			externalId: slug,
			url: `https://cursor.com${path}`,
			title,
			summary: summaryMatch ? stripHtml(summaryMatch[1]).trim() : undefined,
			publishedAt,
		});
	}

	return items;
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
		id: 'cursor-changelog',
		name: 'Cursor Changelog',
		mode: 'append',
	},
	createWebpageExtractor({
		url: CHANGELOG_URL,
		headers: {
			'user-agent': 'beacon/1.0 (+https://github.com/d0zingcat/beacon)',
			accept: 'text/html',
		},
		parse: (html, _ctx) => parseCursorChangelogHtml(html),
	}),
);
