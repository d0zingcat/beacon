import { createWebpageExtractor } from '../../extract/webpage';
import { createSource } from '../factory';
import type { RawItem } from '../types';

export const GEMINI_BLOG_URL = 'https://deepmind.google/blog/';
const BLOG_ORIGIN = 'https://deepmind.google';
const USER_AGENT = 'beacon/1.0 (+https://github.com/d0zingcat/beacon)';

const MONTHS = [
	'January',
	'February',
	'March',
	'April',
	'May',
	'June',
	'July',
	'August',
	'September',
	'October',
	'November',
	'December',
];

/** A single DeepMind blog card's extracted overlay link. */
const ARTICLE_RE = /<article class="card card-blog[^"]*">([\s\S]*?)<\/article>/g;
const OVERLAY_LINK_RE = /<a [^>]*?class=card__overlay-link[^>]*>/;
/** The overlay link's `href` is sometimes quoted (`href="..."`) and sometimes
 *  not (`href=...`). The alternation captures either form; group 1 is the
 *  quoted value, group 2 the unquoted one. */
const HREF_RE = /href=(?:"([^"]*)"|([^" >]+))/;
const TITLE_RE = /card__title[^>]*>([^<]+)</;
const TIME_RE = /datetime="([^"]+)"/;
const CATEGORY_RE = /meta__category">([^<]+)</;

/** DeepMind blog cards render their date as `"<Month> <Year>"`, e.g.
 *  `"May 2026"`, in the `<time datetime>` attribute. Resolve it to the first
 *  day of that month in UTC, or `undefined` for any unrecognised format. */
export function parseGeminiBlogDate(value?: string): string | undefined {
	if (!value) return undefined;
	const match = value.match(/^([A-Za-z]+)\s+(\d{4})$/);
	if (!match) return undefined;
	const monthIndex = MONTHS.indexOf(match[1]);
	if (monthIndex < 0) return undefined;
	return new Date(Date.UTC(Number(match[2]), monthIndex, 1)).toISOString();
}

/** A card's overlay link is sometimes a relative `/blog/...` path rather than an
 *  absolute URL. Resolve against the blog origin so stored URLs are always
 *  visitable deep links and stable dedupe keys. */
export function resolveGeminiBlogUrl(rawUrl: string): string {
	const noQuery = rawUrl.split('?')[0].trim();
	if (noQuery.startsWith('/')) return `${BLOG_ORIGIN}${noQuery}`;
	return noQuery;
}

function slugFromUrl(url: string): string {
	const segments = url.split('/').filter(Boolean);
	return segments.pop() ?? url;
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

/**
 * Deepmind's blog at https://deepmind.google/blog/ is server-side rendered.
 * Each article is an `<article class="card card-blog ...">` card with an
 * overlay link out to its canonical `blog.google` deep link, a title, a
 * month-year date, and a category. The cards carry no summary text, so
 * extracted items describe title + date only.
 */
export function parseGeminiBlogHtml(html: string): RawItem[] {
	const items: RawItem[] = [];
	const seen = new Set<string>();

	let match: RegExpExecArray | null;
	while ((match = ARTICLE_RE.exec(html)) !== null) {
		const block = match[1];

		const titleMatch = block.match(TITLE_RE);
		const overlayMatch = block.match(OVERLAY_LINK_RE);
		if (!titleMatch || !overlayMatch) continue;

		const hrefMatch = overlayMatch[0].match(HREF_RE);
		const rawUrl = hrefMatch ? (hrefMatch[1] ?? hrefMatch[2]) : '';
		// Resolve relative paths and strip tracking params so the slug is a
		// stable dedupe key and the URL is a visitable deep link.
		const url = resolveGeminiBlogUrl(rawUrl);
		const externalId = slugFromUrl(url);
		if (!externalId || seen.has(externalId)) continue;
		seen.add(externalId);

		const timeMatch = block.match(TIME_RE);
		const categoryMatch = block.match(CATEGORY_RE);

		items.push({
			externalId,
			url,
			title: decodeHtml(titleMatch[1]).trim(),
			publishedAt: parseGeminiBlogDate(timeMatch?.[1]),
			raw: categoryMatch ? { category: categoryMatch[1].trim() } : undefined,
		});
	}

	return items;
}

export async function fetchGeminiBlog(fetchFn: typeof fetch): Promise<RawItem[]> {
	const response = await fetchFn(GEMINI_BLOG_URL, {
		headers: {
			'user-agent': USER_AGENT,
			accept: 'text/html,application/xhtml+xml',
		},
	});
	if (!response.ok) {
		throw new Error(`Gemini blog fetch failed: ${response.status} ${response.statusText}`);
	}
	return parseGeminiBlogHtml(await response.text());
}

createSource(
	{
		id: 'gemini-blog',
		name: 'Gemini Blog',
		mode: 'append',
	},
	createWebpageExtractor({
		url: GEMINI_BLOG_URL,
		headers: {
			'user-agent': USER_AGENT,
			accept: 'text/html,application/xhtml+xml',
		},
		parse: (html) => parseGeminiBlogHtml(html),
	}),
);
