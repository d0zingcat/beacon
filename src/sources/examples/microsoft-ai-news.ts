import { createWebpageExtractor } from '../../extract/webpage';
import { createSource } from '../factory';
import type { RawItem } from '../types';

export const MICROSOFT_AI_NEWS_URL = 'https://microsoft.ai/news';
const SITE_ORIGIN = 'https://microsoft.ai';
const USER_AGENT = 'beacon/1.0 (+https://github.com/d0zingcat/beacon)';

const ARTICLE_RE = /<article\b[^>]*>([\s\S]*?)<\/article>/g;
const NEWS_HREF_RE = /href="(https:\/\/microsoft\.ai\/news\/[^"]+|\/news\/[^"]+)"/;
const HEADING_RE = /<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/;
const TIME_RE = /<time\b[^>]*datetime="([^"]+)"/;

function decodeHtml(value: string): string {
	return value
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&#x27;/g, "'")
		.replace(/&#8217;/g, '\u2019')
		.replace(/&#8216;/g, '\u2018')
		.replace(/&#8220;/g, '\u201c')
		.replace(/&#8221;/g, '\u201d')
		.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function cleanText(value: string): string {
	return decodeHtml(value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

export function resolveMicrosoftAiNewsUrl(rawUrl: string): string {
	const noQuery = rawUrl.split('?')[0].trim();
	if (noQuery.startsWith('/')) return `${SITE_ORIGIN}${noQuery}`;
	return noQuery;
}

function slugFromUrl(url: string): string {
	const segments = url.split('/').filter(Boolean);
	return segments.pop() ?? url;
}

export function parseMicrosoftAiDate(value?: string): string | undefined {
	if (!value) return undefined;
	const ms = Date.parse(value.trim());
	if (Number.isNaN(ms)) return undefined;
	return new Date(ms).toISOString();
}

/**
 * Microsoft AI News at https://microsoft.ai/news is server-rendered WordPress
 * HTML. Each news card is an `<article>` containing a link to
 * `/news/<slug>/`, a heading title, and a `<time datetime="...">` timestamp.
 */
export function parseMicrosoftAiNewsHtml(html: string): RawItem[] {
	const items: RawItem[] = [];
	const seen = new Set<string>();

	const re = new RegExp(ARTICLE_RE.source, 'g');
	let match: RegExpExecArray | null;
	while ((match = re.exec(html)) !== null) {
		const block = match[1];
		const hrefMatch = block.match(NEWS_HREF_RE);
		const headingMatch = block.match(HEADING_RE);
		if (!hrefMatch || !headingMatch) continue;

		const url = resolveMicrosoftAiNewsUrl(hrefMatch[1]);
		const externalId = slugFromUrl(url);
		if (!externalId || seen.has(externalId)) continue;

		const title = cleanText(headingMatch[1]);
		if (!title) continue;

		seen.add(externalId);
		const timeMatch = block.match(TIME_RE);

		items.push({
			externalId,
			url,
			title,
			publishedAt: parseMicrosoftAiDate(timeMatch?.[1]),
		});
	}

	return items;
}

export async function fetchMicrosoftAiNews(fetchFn: typeof fetch): Promise<RawItem[]> {
	const response = await fetchFn(MICROSOFT_AI_NEWS_URL, {
		headers: {
			'user-agent': USER_AGENT,
			accept: 'text/html,application/xhtml+xml',
		},
	});
	if (!response.ok) {
		throw new Error(`Microsoft AI News fetch failed: ${response.status} ${response.statusText}`);
	}
	return parseMicrosoftAiNewsHtml(await response.text());
}

createSource(
	{
		id: 'microsoft-ai-news',
		name: 'Microsoft AI News',
		mode: 'append',
	},
	createWebpageExtractor({
		url: MICROSOFT_AI_NEWS_URL,
		headers: {
			'user-agent': USER_AGENT,
			accept: 'text/html,application/xhtml+xml',
		},
		parse: (html) => parseMicrosoftAiNewsHtml(html),
	}),
);
