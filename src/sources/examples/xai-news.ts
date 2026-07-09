import { createWebpageExtractor } from '../../extract/webpage';
import { createSource } from '../factory';
import type { RawItem } from '../types';

const SITE_URL = 'https://x.ai';
const BLOG_URL = `${SITE_URL}/blog`;
const USER_AGENT =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * x.ai's `/blog` page is a server-rendered Next.js listing of every news post,
 * each linked at `/news/<slug>`. It mixes two card shapes:
 *
 *  - **Featured cards** (hero + top grid): the title lives in an `<img alt>`
 *    for the grid cards, and in an `<h1>`/`<h2>` for the hero card (which has
 *    no image — it uses a gradient shader instead).
 *  - **List cards** ("All posts"): a `<h3>` title, a `<p>` summary, and a
 *    trailing `<div>Mon DD, YYYY</div>` date.
 *
 * Every card is an `<a class="group/card..." href="/news/<slug}">…</a>`.
 */

/** A single post card anchor. The capture groups are `slug` and inner `body`. */
const CARD_RE =
	/<a\s+class="group\/card[^"]*"[^>]*href="(\/news\/[a-z0-9-]+)"[^>]*>([\s\S]*?)<\/a>/g;

/** Publish date, e.g. "Jul 8, 2026". Featured cards show it twice (above and
 *  below the heading) — either occurrence parses identically. */
const DATE_RE = /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),\s+(\d{4})/;

const MONTHS: Record<string, string> = {
	Jan: '01',
	Feb: '02',
	Mar: '03',
	Apr: '04',
	May: '05',
	Jun: '06',
	Jul: '07',
	Aug: '08',
	Sep: '09',
	Oct: '10',
	Nov: '11',
	Dec: '12',
};

function stripHtml(value: string): string {
	return decodeHtml(value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
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
 * Featured grid cards bake the title into the image alt. The hero card has no
 * image, so fall back to its heading. List cards also use a heading.
 */
function extractCardTitle(body: string): string | undefined {
	const imgMatch = body.match(/<img[^>]*alt="([^"]+)"[^>]*>/);
	if (imgMatch) return decodeHtml(imgMatch[1]).trim();

	const headingMatch = body.match(/<h[123][^>]*>([\s\S]*?)<\/h[123]>/);
	if (headingMatch) return stripHtml(headingMatch[1]);

	return undefined;
}

function extractCardSummary(body: string): string | undefined {
	const pMatch = body.match(/<p[^>]*>([\s\S]*?)<\/p>/);
	if (!pMatch) return undefined;
	const text = stripHtml(pMatch[1]);
	return text || undefined;
}

function parseXaiDate(value: string): string | undefined {
	const match = value.match(/^([A-Z][a-z]{2})\s+(\d{1,2}),\s+(\d{4})$/);
	if (!match) return undefined;
	const month = MONTHS[match[1]];
	if (!month) return undefined;
	const day = match[2].padStart(2, '0');
	const iso = `${match[3]}-${month}-${day}T00:00:00.000Z`;
	const date = new Date(iso);
	return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function parseNewsHtml(html: string): RawItem[] {
	const items: RawItem[] = [];
	const seen = new Set<string>();

	for (const cardMatch of html.matchAll(CARD_RE)) {
		const slug = cardMatch[1].replace('/news/', '');
		if (seen.has(slug)) continue;

		const body = cardMatch[2];
		const title = extractCardTitle(body);
		if (!title) continue;

		seen.add(slug);
		const dateMatch = body.match(DATE_RE);

		items.push({
			externalId: slug,
			url: `${SITE_URL}/news/${slug}`,
			title,
			summary: extractCardSummary(body),
			publishedAt: dateMatch ? parseXaiDate(dateMatch[0]) : undefined,
		});
	}

	return items;
}

export async function fetchNews(fetchFn: typeof fetch): Promise<RawItem[]> {
	const response = await fetchFn(BLOG_URL, {
		headers: {
			'user-agent': USER_AGENT,
			accept: 'text/html,application/xhtml+xml',
		},
	});
	if (!response.ok) {
		throw new Error(`x.ai news fetch failed: ${response.status} ${response.statusText}`);
	}
	return parseNewsHtml(await response.text());
}

createSource(
	{
		id: 'xai-news',
		name: 'xAI News',
		mode: 'append',
	},
	createWebpageExtractor({
		url: BLOG_URL,
		headers: {
			'user-agent': USER_AGENT,
			accept: 'text/html,application/xhtml+xml',
		},
		parse: (html) => parseNewsHtml(html),
	}),
);
