import { createWebpageExtractor } from '../../extract/webpage';
import { createSource } from '../factory';
import type { RawItem } from '../types';

const SITE_URL = 'https://artificialanalysis.ai';
const CHANGELOG_URL = `${SITE_URL}/changelog`;
const USER_AGENT =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Artificial Analysis `/changelog` is a server-rendered Next.js timeline.
 * Each day is an `<h4>DD Mon YYYY</h4>`, followed by card anchors:
 *
 *   <a class="flex flex-col gap-1 ..." href="/models/...|/articles/...">
 *     <span class="text-xs">New language model evaluation results available</span>
 *     <h3>Model or article title</h3>
 *     <p>optional summary / score</p>
 *   </a>
 *
 * Leaderboard cards often reuse the same href (e.g. `/image/leaderboard/...`),
 * so external ids include date + path + title.
 */

const DATE_HEADING_RE = /<h4 class="text-xs font-medium pt-6 pb-2">([^<]+)<\/h4>/g;
const ENTRY_RE =
	/<a class="flex flex-col gap-1[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;

const DATE_RE = /^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})$/;

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
		.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
		.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function parseChangelogDate(value: string): string | undefined {
	const match = value.trim().match(DATE_RE);
	if (!match) return undefined;
	const month = MONTHS[match[2]];
	if (!month) return undefined;
	const day = match[1].padStart(2, '0');
	const iso = `${match[3]}-${month}-${day}T00:00:00.000Z`;
	const date = new Date(iso);
	return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function cleanLabel(label: string): string {
	return label.replace(/^(?:🔔|🚀)\s*/, '').trim();
}

function extractEntryLabel(body: string): string | undefined {
	const match = body.match(/<span class="text-xs">([\s\S]*?)<\/span>/);
	if (!match) return undefined;
	const text = stripHtml(match[1]);
	return text || undefined;
}

function extractEntryTitle(body: string): string | undefined {
	const match = body.match(/<h3[^>]*>([\s\S]*?)<\/h3>/);
	if (!match) return undefined;
	const text = stripHtml(match[1]);
	return text || undefined;
}

function extractEntrySummary(body: string): string | undefined {
	const proseMatch = body.match(/<div class="prose[^"]*"[^>]*>[\s\S]*?<p>([\s\S]*?)<\/p>/i);
	if (proseMatch) {
		const text = stripHtml(proseMatch[1]);
		if (text) return text;
	}
	const pMatch = body.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
	if (!pMatch) return undefined;
	const text = stripHtml(pMatch[1]);
	return text || undefined;
}

function resolveEntryUrl(href: string): string {
	return new URL(href, SITE_URL).toString();
}

function buildExternalId(publishedAt: string | undefined, href: string, title: string): string {
	const dateKey = publishedAt?.slice(0, 10) ?? 'unknown-date';
	const path = new URL(href, SITE_URL).pathname + new URL(href, SITE_URL).hash;
	return `${dateKey}:${path}:${title}`;
}

function buildSummary(label: string | undefined, detail: string | undefined): string | undefined {
	const cleaned = label ? cleanLabel(label) : undefined;
	if (cleaned && detail && cleaned !== detail) {
		return `${cleaned} — ${detail}`;
	}
	return detail || cleaned || undefined;
}

type TimelineEvent =
	| { kind: 'date'; index: number; value: string }
	| { kind: 'entry'; index: number; href: string; body: string };

function collectTimelineEvents(html: string): TimelineEvent[] {
	const events: TimelineEvent[] = [];

	for (const match of html.matchAll(DATE_HEADING_RE)) {
		events.push({ kind: 'date', index: match.index ?? 0, value: match[1] });
	}
	for (const match of html.matchAll(ENTRY_RE)) {
		events.push({
			kind: 'entry',
			index: match.index ?? 0,
			href: match[1],
			body: match[2],
		});
	}

	events.sort((a, b) => a.index - b.index);
	return events;
}

export function parseChangelogHtml(html: string): RawItem[] {
	const items: RawItem[] = [];
	const seen = new Set<string>();
	let publishedAt: string | undefined;

	for (const event of collectTimelineEvents(html)) {
		if (event.kind === 'date') {
			publishedAt = parseChangelogDate(event.value);
			continue;
		}

		const title = extractEntryTitle(event.body);
		if (!title) continue;

		const url = resolveEntryUrl(event.href);
		const externalId = buildExternalId(publishedAt, event.href, title);
		if (seen.has(externalId)) continue;
		seen.add(externalId);

		const label = extractEntryLabel(event.body);
		const detail = extractEntrySummary(event.body);

		items.push({
			externalId,
			url,
			title,
			summary: buildSummary(label, detail),
			publishedAt,
		});
	}

	return items;
}

export async function fetchChangelog(fetchFn: typeof fetch): Promise<RawItem[]> {
	const response = await fetchFn(CHANGELOG_URL, {
		headers: {
			'user-agent': USER_AGENT,
			accept: 'text/html,application/xhtml+xml',
		},
	});
	if (!response.ok) {
		throw new Error(
			`Artificial Analysis changelog fetch failed: ${response.status} ${response.statusText}`,
		);
	}
	return parseChangelogHtml(await response.text());
}

createSource(
	{
		id: 'artificial-analysis-changelog',
		name: 'Artificial Analysis Changelog',
		mode: 'append',
	},
	createWebpageExtractor({
		url: CHANGELOG_URL,
		headers: {
			'user-agent': USER_AGENT,
			accept: 'text/html,application/xhtml+xml',
		},
		parse: (html) => parseChangelogHtml(html),
	}),
);
