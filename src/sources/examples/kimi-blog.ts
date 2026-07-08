import { createWebpageExtractor } from '../../extract/webpage';
import { createSource } from '../factory';
import type { RawItem } from '../types';

const BLOG_URL = 'https://www.kimi.com/blog/';
const BASE_URL = 'https://www.kimi.com';
const BLOG_PATH = /^\/blog\/([a-z0-9][a-z0-9-]*)$/;

/**
 * Kimi (Moonshot AI) research blog at https://www.kimi.com/blog/. The page is
 * server-side rendered (Next.js) and lists research articles as cards. Newer
 * posts link to in-site `/blog/<slug>` pages; older research items link out to
 * GitHub / Hugging Face. Both are tracked so the source covers the full news
 * listing.
 */
export function parseKimiBlogHtml(html: string): RawItem[] {
	const byId = new Map<string, RawItem>();
	const anchorRe = /<a href="([^"]+)" aria-label="([^"]+)" class="absolute inset-0[^"]*"[^>]*><\/a>/g;

	let match: RegExpExecArray | null;
	while ((match = anchorRe.exec(html)) !== null) {
		const href = match[1];
		const ariaTitle = match[2];
		const segment = html.slice(match.index, match.index + 2000);

		const externalId = blogSlugFromHref(href) ?? href;
		if (byId.has(externalId)) continue;

		const descMatch = segment.match(/<p class="card-desc[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
		const dateMatch = segment.match(/<p class="card-date[^"]*"[^>]*>([\s\S]*?)<\/p>/i);

		const title = stripHtml(ariaTitle).trim();
		if (!title) continue;

		const url = href.startsWith('/') ? `${BASE_URL}${href}` : href;
		const publishedAt = dateMatch ? parseCardDate(stripHtml(dateMatch[1]).trim()) : undefined;

		byId.set(externalId, {
			externalId,
			url,
			title,
			summary: descMatch ? stripHtml(descMatch[1]).trim() : undefined,
			publishedAt,
		});
	}

	return [...byId.values()];
}

function blogSlugFromHref(href: string): string | null {
	const match = href.match(BLOG_PATH);
	return match ? match[1] : null;
}

function parseCardDate(value: string): string | undefined {
	// Cards render dates as `YYYY/MM/DD`.
	const match = value.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
	if (!match) return undefined;
	const iso = `${match[1]}-${match[2]}-${match[3]}`;
	const ms = Date.parse(iso);
	return Number.isNaN(ms) ? undefined : new Date(ms).toISOString();
}

function stripHtml(value: string): string {
	return decodeHtml(value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '));
}

function decodeHtml(value: string): string {
	return value
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
		id: 'kimi-blog',
		name: 'Kimi Blog',
		mode: 'append',
	},
	createWebpageExtractor({
		url: BLOG_URL,
		headers: {
			'user-agent': 'beacon/1.0 (+https://github.com/d0zingcat/beacon)',
			accept: 'text/html,application/xhtml+xml',
		},
		parse: (html, _ctx) => parseKimiBlogHtml(html),
	}),
);
