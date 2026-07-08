import { createWebpageExtractor } from '../../extract/webpage';
import { createSource } from '../factory';
import type { RawItem } from '../types';

const SITE_URL = 'https://api-docs.deepseek.com';

/**
 * DeepSeek's `/zh-cn/news/*` articles have no dedicated index page — instead
 * every news page renders the full archive in its expanded Docusaurus sidebar.
 * Pinning any one article (here the latest) gives us the whole list: each
 * sidebar link is a major launch announcement with a trailing `YYYY/MM/DD`.
 */
const LATEST_NEWS_URL = `${SITE_URL}/zh-cn/news/news260424`;
const USER_AGENT = 'beacon/1.0 (+https://github.com/d0zingcat/beacon)';

/** Sidebar news links, e.g. "...href="/zh-cn/news/news260424">Title 2026/04/24</a>". */
const NEWS_LINK_RE = /<a [^>]*href="(\/zh-cn\/news\/news(\d+))"[^>]*>([\s\S]*?)<\/a>/g;

/** Trailing date baked into each sidebar link text. */
const TRAILING_DATE_RE = /^(.*?)\s+(\d{4}\/\d{2}\/\d{2})\s*$/;

function stripHtml(value: string): string {
	return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseNewsDate(value: string): string | undefined {
	const match = value.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
	if (!match) return undefined;
	const date = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00Z`);
	return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

/** Pull the news archive list out of any news article's sidebar. */
export function parseNewsIndexHtml(html: string): RawItem[] {
	const items: RawItem[] = [];
	const seen = new Set<string>();
	let match: RegExpExecArray | null;

	NEWS_LINK_RE.lastIndex = 0;
	while ((match = NEWS_LINK_RE.exec(html)) !== null) {
		const path = match[1];
		const slug = match[2];
		if (seen.has(slug)) continue;
		const text = stripHtml(match[3]);
		const dateMatch = text.match(TRAILING_DATE_RE);
		// The parent "新闻" category link shares the first article's slug but
		// has no trailing date; dropping it *before* touching `seen` keeps the
		// real article from being treated as a duplicate.
		if (!dateMatch) continue;

		const title = dateMatch[1].trim();
		if (!title) continue;

		seen.add(slug);
		items.push({
			externalId: `news-${slug}`,
			url: `${SITE_URL}${path}`,
			title,
			publishedAt: parseNewsDate(dateMatch[2]),
		});
	}

	return items;
}

export async function fetchNewsIndex(fetchFn: typeof fetch): Promise<RawItem[]> {
	const response = await fetchFn(LATEST_NEWS_URL, {
		headers: {
			'user-agent': USER_AGENT,
			accept: 'text/html',
		},
	});
	if (!response.ok) {
		throw new Error(`DeepSeek news fetch failed: ${response.status} ${response.statusText}`);
	}
	return parseNewsIndexHtml(await response.text());
}

createSource(
	{
		id: 'deepseek-news',
		name: 'DeepSeek News',
		mode: 'append',
	},
	createWebpageExtractor({
		url: LATEST_NEWS_URL,
		headers: {
			'user-agent': USER_AGENT,
			accept: 'text/html',
		},
		parse: (html) => parseNewsIndexHtml(html),
	}),
);
