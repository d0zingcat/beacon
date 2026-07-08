import { createWebpageExtractor } from '../../extract/webpage';
import { createSource } from '../factory';
import type { RawItem } from '../types';

const SITE_URL = 'https://api-docs.deepseek.com';
const UPDATES_URL = `${SITE_URL}/zh-cn/updates`;
const USER_AGENT = 'beacon/1.0 (+https://github.com/d0zingcat/beacon)';

/** A changelog entry's date, from its `<h2>` heading. Mixes `:` and `：`. */
const DATE_HEADING_RE = /时间[：:]\s*(\d{4}-\d{2}-\d{2})/;

/** Anchor slug on each `<h3>` entry, e.g. `id="deepseek-v4"`. */
const ENTRY_ID_RE = /id="([^"]+)"/;

function stripHtml(value: string): string {
	return decodeHtml(
		value
			.replace(/<[^>]+>/g, ' ')
			// Docusaurus injects zero-width spaces (U+200B) in per-heading hash links.
			.replace(/[\uFEFF\u200B\u200C\u200D]/g, '')
			.replace(/\s+/g, ' ')
			.trim(),
	);
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

function parseIsoDate(value: string): string | undefined {
	const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (!match) return undefined;
	const date = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00Z`);
	return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function truncateSummary(text: string, max = 280): string {
	if (text.length <= max) return text;
	return `${text.slice(0, max - 3)}...`;
}

/**
 * Parse the single continuous 更新日志 (changelog) page. Each `<h2>` date
 * heading groups one or more `<h3>` entries until the next `<hr>`/`<h2>`; both
 * half-width (`:`) and full-width (`：`) colons appear in the date headings.
 */
export function parseUpdatesHtml(html: string): RawItem[] {
	const items: RawItem[] = [];

	for (const section of html.split(/<h2/).slice(1)) {
		const dateMatch = section.match(DATE_HEADING_RE);
		if (!dateMatch) continue;
		const date = dateMatch[1];

		// section = "date-heading</h2>...<h3 id="..">title</h3>content...<h3...".
		// The slice(1) drops everything between the <h2> and the first <h3>.
		for (const entry of section.split(/<h3/).slice(1)) {
			const idMatch = entry.match(ENTRY_ID_RE);
			const slug = idMatch?.[1]?.trim();
			if (!slug) continue;

			const tagEnd = entry.indexOf('>');
			const h3Close = entry.indexOf('</h3>', tagEnd);
			const title = tagEnd !== -1 && h3Close !== -1 ? stripHtml(entry.slice(tagEnd + 1, h3Close)) : '';
			if (!title) continue;

			const contentStart = h3Close !== -1 ? h3Close + 5 : tagEnd + 1;
			const rawContent = entry.slice(contentStart);
			const hrIndex = rawContent.indexOf('<hr');
			const content = hrIndex !== -1 ? rawContent.slice(0, hrIndex) : rawContent;

			items.push({
				externalId: `${date}-${slug}`,
				url: `${UPDATES_URL}#${slug}`,
				title,
				summary: truncateSummary(stripHtml(content)) || undefined,
				publishedAt: parseIsoDate(date),
			});
		}
	}

	return items;
}

export async function fetchUpdates(fetchFn: typeof fetch): Promise<RawItem[]> {
	const response = await fetchFn(UPDATES_URL, {
		headers: {
			'user-agent': USER_AGENT,
			accept: 'text/html',
		},
	});
	if (!response.ok) {
		throw new Error(`DeepSeek updates fetch failed: ${response.status} ${response.statusText}`);
	}
	return parseUpdatesHtml(await response.text());
}

createSource(
	{
		id: 'deepseek-updates',
		name: 'DeepSeek Updates',
		mode: 'append',
	},
	createWebpageExtractor({
		url: UPDATES_URL,
		headers: {
			'user-agent': USER_AGENT,
			accept: 'text/html',
		},
		parse: (html) => parseUpdatesHtml(html),
	}),
);
