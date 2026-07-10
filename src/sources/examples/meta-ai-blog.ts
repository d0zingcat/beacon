import { createWebpageExtractor } from '../../extract/webpage';
import { createSource } from '../factory';
import type { RawItem } from '../types';

const SITE_URL = 'https://ai.meta.com';
const BLOG_URL = `${SITE_URL}/blog/`;
const USER_AGENT =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';

/**
 * Meta AI's `/blog/` page is server-rendered HTML. Every post (hero or grid
 * card) is a block holding TWO anchors that share the same `/blog/<slug>/`
 * URL:
 *
 *   1. **Image anchor** — wraps a `<div>` containing a thumbnail `<img>`.
 *      Optional pill (`FEATURED`) sits above the image.
 *   2. **Text anchor** — wraps ONLY the title text (no nested tags). It lives
 *      inside a content `<div>` that also holds a category label
 *      (`Research`/`Product`) and a trailing "Month DD, YYYY" date.
 *
 * By matching anchors whose inner content is plain text (`[^<]+`), we
 * automatically land on the text anchor of each pair and never the image one.
 * The capture includes the trailing date so each match is self-contained.
 */

const MONTHS_LONG =
	'(?:January|February|March|April|May|June|July|August|September|October|November|December)';
const MONTHS_SHORT = '(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)';

/** Matches `Month DD, YYYY` (long or short month form). */
const DATE_RE = new RegExp(`(${MONTHS_LONG}|${MONTHS_SHORT})\\s+(\\d{1,2}),\\s+(\\d{4})`);

/**
 * Groups captured per match:
 *   1 — slug
 *   2 — title (plain text, trimmed)
 *   3 — full date string
 */
const CARD_RE = new RegExp(
	`<a[^>]*href="(?:https?://ai\\.meta\\.com)?/blog/([a-zA-Z0-9_-]+)/"[^>]*>\\s*([^<]+?)\\s*</a>` +
		`([\\s\\S]*?${DATE_RE.source})`,
	'g',
);

const MONTH_INDEX: Record<string, string> = {
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
	January: '01',
	February: '02',
	March: '03',
	April: '04',
	June: '06',
	July: '07',
	August: '08',
	September: '09',
	October: '10',
	November: '11',
	December: '12',
};

function parseMetaDate(month: string, day: string, year: string): string | undefined {
	const mm = MONTH_INDEX[month];
	if (!mm) return undefined;
	const iso = `${year}-${mm}-${day.padStart(2, '0')}T00:00:00.000Z`;
	const date = new Date(iso);
	return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function parseMetaBlogHtml(html: string): RawItem[] {
	const items: RawItem[] = [];
	const seen = new Set<string>();

	for (const m of html.matchAll(CARD_RE)) {
		const slug = m[1];
		if (seen.has(slug)) continue;

		const title = m[2].trim();
		if (!title) continue;

		seen.add(slug);

		const dateStr = m[3]; // trailing content containing the date
		const dateMatch = dateStr.match(
			new RegExp(`(${MONTHS_LONG}|${MONTHS_SHORT})\\s+(\\d{1,2}),\\s+(\\d{4})`),
		);

		items.push({
			externalId: slug,
			url: `${SITE_URL}/blog/${slug}/`,
			title,
			publishedAt: dateMatch
				? parseMetaDate(dateMatch[1], dateMatch[2], dateMatch[3])
				: undefined,
		});
	}

	return items;
}

createSource(
	{
		id: 'meta-ai-blog',
		name: 'Meta AI Blog',
		mode: 'append',
	},
	createWebpageExtractor({
		url: BLOG_URL,
		headers: {
			'user-agent': USER_AGENT,
			accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
			'accept-language': 'en-US,en;q=0.9',
			// Meta's CDN rejects a Chrome UA that lacks the Sec-Fetch-* headers a
			// real browser sends on navigation — without these it returns 400.
			'sec-fetch-dest': 'document',
			'sec-fetch-mode': 'navigate',
			'sec-fetch-site': 'none',
			'sec-fetch-user': '?1',
			'upgrade-insecure-requests': '1',
		},
		parse: (html) => parseMetaBlogHtml(html),
	}),
);
