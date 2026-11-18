import { createWebpageExtractor } from '../../extract/webpage';
import { createSource } from '../factory';
import type { RawItem } from '../types';

export const LONGCAT_CHANGELOG_URL = 'https://longcat.chat/platform/docs/zh/change-log';
const USER_AGENT = 'beacon/1.0 (+https://github.com/d0zingcat/beacon)';
const MAX_SUMMARY_LENGTH = 300;

const EDITION_AI_BLOCK_RE = /<div\s+data-edition-only="ai">[\s\S]*?<\/div>/g;
const H2_RE = /<h2\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/h2>/g;
const H3_RE = /<h3\b[^>]*>([\s\S]*?)<\/h3>/;
const DATE_RE = /(\d{4})-(\d{2})-(\d{2})/;

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

function cleanText(value: string): string {
	return decodeHtml(
		value
			.replace(/<[^>]+>/g, ' ')
			.replace(/\u200b/g, '')
			.replace(/\s+/g, ' ')
			.trim(),
	);
}

function truncateSummary(text: string): string | undefined {
	if (!text) return undefined;
	if (text.length <= MAX_SUMMARY_LENGTH) return text;
	return `${text.slice(0, MAX_SUMMARY_LENGTH - 1)}…`;
}

export function parseLongcatChangelogDate(value: string): string | undefined {
	const match = value.match(DATE_RE);
	if (!match) return undefined;
	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	const date = new Date(Date.UTC(year, month - 1, day));
	if (
		Number.isNaN(date.getTime()) ||
		date.getUTCFullYear() !== year ||
		date.getUTCMonth() !== month - 1 ||
		date.getUTCDate() !== day
	) {
		return undefined;
	}
	return date.toISOString();
}

function sliceMainDoc(html: string): string {
	const docStart = html.indexOf('vp-doc');
	const start = docStart >= 0 ? docStart : 0;
	const mainEnd = html.indexOf('</main>', start);
	const body = mainEnd >= 0 ? html.slice(start, mainEnd) : html.slice(start);
	// `longcat.chat` renders `data-edition-only="chat com"` and hides `data-edition-only="ai"`.
	return body.replace(EDITION_AI_BLOCK_RE, '');
}

/**
 * LongCat API Docs changelog at https://longcat.chat/platform/docs/zh/change-log
 * is server-rendered VitePress HTML. Each release section starts with an
 * `<h2 id="版本-YYYY-MM-DD">版本: YYYY-MM-DD</h2>` heading followed by an
 * `<h3>` release title and changelog body.
 */
export function parseLongcatChangelogHtml(html: string): RawItem[] {
	const doc = sliceMainDoc(html);
	const headings: Array<{ id: string; text: string; start: number; bodyStart: number }> = [];

	const h2Re = new RegExp(H2_RE.source, 'g');
	let match: RegExpExecArray | null;
	while ((match = h2Re.exec(doc)) !== null) {
		headings.push({
			id: match[1],
			text: cleanText(match[2]),
			start: match.index,
			bodyStart: match.index + match[0].length,
		});
	}

	const items: RawItem[] = [];
	const seen = new Set<string>();

	for (let i = 0; i < headings.length; i += 1) {
		const current = headings[i];
		const dateMatch = current.text.match(DATE_RE);
		if (!dateMatch) continue;

		const dateStr = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
		const publishedAt = parseLongcatChangelogDate(dateStr);
		if (!publishedAt || seen.has(dateStr)) continue;
		seen.add(dateStr);

		const bodyEnd = i + 1 < headings.length ? headings[i + 1].start : doc.length;
		const sectionHtml = doc.slice(current.bodyStart, bodyEnd);

		const h3Match = sectionHtml.match(H3_RE);
		const title = h3Match ? cleanText(h3Match[1]) : current.text;
		if (!title) continue;

		const bodyWithoutH3 = h3Match ? sectionHtml.replace(h3Match[0], '') : sectionHtml;
		const summary = truncateSummary(cleanText(bodyWithoutH3));

		items.push({
			externalId: dateStr,
			url: `${LONGCAT_CHANGELOG_URL}#${current.id}`,
			title,
			summary,
			publishedAt,
		});
	}

	return items;
}

export async function fetchLongcatChangelog(fetchFn: typeof fetch): Promise<RawItem[]> {
	const response = await fetchFn(LONGCAT_CHANGELOG_URL, {
		headers: {
			'user-agent': USER_AGENT,
			accept: 'text/html,application/xhtml+xml',
		},
	});
	if (!response.ok) {
		throw new Error(`LongCat changelog fetch failed: ${response.status} ${response.statusText}`);
	}
	return parseLongcatChangelogHtml(await response.text());
}

createSource(
	{
		id: 'longcat-changelog',
		name: 'LongCat Changelog',
		mode: 'append',
	},
	createWebpageExtractor({
		url: LONGCAT_CHANGELOG_URL,
		headers: {
			'user-agent': USER_AGENT,
			accept: 'text/html,application/xhtml+xml',
		},
		parse: (html) => parseLongcatChangelogHtml(html),
	}),
);
