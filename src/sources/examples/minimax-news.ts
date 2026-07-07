import { createSource } from '../factory';
import type { RawItem } from '../types';

export const MINIMAX_SITE_URL = 'https://www.minimaxi.com';
export const MINIMAX_NEWS_LIST_URL = 'https://www.minimaxi.com/api/news';
export const MINIMAX_DOCS_URL = 'https://platform.minimaxi.com';

export const MINIMAX_DOCS_PAGES = [
	{
		key: 'models',
		path: '/docs/release-notes/models',
		title: '模型发布',
		dateHeader: '##',
	},
	{
		key: 'apis',
		path: '/docs/release-notes/apis',
		title: '功能更新',
		dateHeader: '###',
	},
] as const;

const CARD_RE =
	/<Card\s+title="([^"]+)"[^>]*href="([^"]*)"[^>]*>\s*([\s\S]*?)\s*<\/Card>/g;
const BULLET_RE = /^\s*[*-]\s+(.+)$/m;

export interface MinimaxNewsEntry {
	newsId: string;
	title: string;
	summary?: string;
	slug: string;
	publishDate?: number | string;
	tags?: string[];
}

export interface MinimaxNewsListResponse {
	data?: MinimaxNewsEntry[];
	hasMore?: boolean;
}

export interface MinimaxDocsCardEntry {
	date: string;
	title: string;
	href: string;
	body: string;
}

export interface MinimaxDocsBulletEntry {
	date: string;
	bullets: string[];
}

export function buildMinimaxNewsUrl(slug: string): string {
	return `${MINIMAX_SITE_URL}/news/${slug}`;
}

export function buildMinimaxDocsUrl(pagePath: string, date: string): string {
	return `${MINIMAX_DOCS_URL}${pagePath}#${encodeURIComponent(date)}`;
}

export function buildMinimaxDocsExternalId(
	pageKey: string,
	date: string,
	title: string,
): string {
	return `${pageKey}:${date}:${title}`;
}

export function parseMinimaxChineseDate(text: string): string | undefined {
	const withDay = text.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
	if (withDay) {
		const [, year, month, day] = withDay;
		return `${year}-${month!.padStart(2, '0')}-${day!.padStart(2, '0')}`;
	}

	const monthOnly = text.match(/(\d{4})\s*年\s*(\d{1,2})\s*月/);
	if (monthOnly) {
		const [, year, month] = monthOnly;
		return `${year}-${month!.padStart(2, '0')}-01`;
	}

	return undefined;
}

export function parseMinimaxPublishDate(value?: number | string): string | undefined {
	if (value === undefined || value === null || value === '') return undefined;

	if (typeof value === 'number') {
		const millis = value > 1_000_000_000_000 ? value : value * 1000;
		const parsed = new Date(millis);
		return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
	}

	const parsed = new Date(value);
	return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

export function normalizeMinimaxHref(href: string): string {
	const trimmed = href.trim();
	if (!trimmed) return MINIMAX_DOCS_URL;
	if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
		return trimmed;
	}
	if (trimmed.startsWith('/')) {
		return `${MINIMAX_DOCS_URL}${trimmed}`;
	}
	return `${MINIMAX_DOCS_URL}/${trimmed}`;
}

export function stripMinimaxMarkdown(text: string): string {
	return text
		.replace(/<br\s*\/?>/gi, ' ')
		.replace(/\*\*([^*]+)\*\*/g, '$1')
		.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
		.replace(/\\_/g, '_')
		.replace(/\s+/g, ' ')
		.trim();
}

export function parseMinimaxDocsCards(markdown: string): MinimaxDocsCardEntry[] {
	const normalized = markdown.replace(/\r\n/g, '\n');
	const dateMatches = [...normalized.matchAll(/^##\s+(.+)$/gm)];
	const cardMatches = [...normalized.matchAll(CARD_RE)];
	const items: MinimaxDocsCardEntry[] = [];

	for (const match of cardMatches) {
		const title = match[1]?.trim();
		const href = match[2]?.trim();
		const body = match[3]?.trim() ?? '';
		const matchIndex = match.index ?? 0;
		if (!title || !href) continue;

		let date = '';
		for (const dateMatch of dateMatches) {
			const dateIndex = dateMatch.index ?? 0;
			if (dateIndex > matchIndex) break;
			date = dateMatch[1]?.trim() ?? date;
		}
		if (!date) continue;

		items.push({ date, title, href, body });
	}

	return items;
}

export function parseMinimaxDocsBulletSections(markdown: string): MinimaxDocsBulletEntry[] {
	const items: MinimaxDocsBulletEntry[] = [];
	let currentDate = '';
	let currentBullets: string[] = [];

	const flush = () => {
		if (!currentDate || currentBullets.length === 0) return;
		items.push({ date: currentDate, bullets: currentBullets });
		currentBullets = [];
	};

	for (const line of markdown.replace(/\r\n/g, '\n').split('\n')) {
		const dateMatch = line.match(/^###\s+(.+)$/);
		if (dateMatch?.[1]) {
			flush();
			currentDate = dateMatch[1].trim();
			continue;
		}

		const bulletMatch = line.match(/^\s*[*-]\s+(.+)$/);
		if (bulletMatch?.[1] && currentDate) {
			currentBullets.push(bulletMatch[1].trim());
		}
	}

	flush();
	return items;
}

export function parseMinimaxNewsApiList(data: MinimaxNewsEntry[]): RawItem[] {
	const items: RawItem[] = [];
	const seen = new Set<string>();

	for (const entry of data) {
		if (!entry.title?.trim() || !entry.newsId?.trim() || !entry.slug?.trim()) continue;

		const externalId = entry.newsId.trim();
		if (seen.has(externalId)) continue;
		seen.add(externalId);

		items.push({
			externalId,
			url: buildMinimaxNewsUrl(entry.slug.trim()),
			title: entry.title.trim(),
			summary: entry.summary?.trim() || entry.tags?.join(', ') || undefined,
			publishedAt: parseMinimaxPublishDate(entry.publishDate),
		});
	}

	return items;
}

export function parseMinimaxModelsMarkdown(
	markdown: string,
	page: (typeof MINIMAX_DOCS_PAGES)[number],
): RawItem[] {
	const items: RawItem[] = [];
	const seen = new Set<string>();

	for (const entry of parseMinimaxDocsCards(markdown)) {
		const isoDate = parseMinimaxChineseDate(entry.date);
		const externalId = buildMinimaxDocsExternalId(page.key, entry.date, entry.title);
		if (seen.has(externalId)) continue;
		seen.add(externalId);

		items.push({
			externalId,
			url: normalizeMinimaxHref(entry.href),
			title: entry.title,
			summary: stripMinimaxMarkdown(entry.body) || undefined,
			publishedAt: isoDate ? new Date(`${isoDate}T00:00:00.000Z`).toISOString() : undefined,
		});
	}

	return items;
}

export function parseMinimaxApisMarkdown(
	markdown: string,
	page: (typeof MINIMAX_DOCS_PAGES)[number],
): RawItem[] {
	const items: RawItem[] = [];
	const seen = new Set<string>();

	for (const section of parseMinimaxDocsBulletSections(markdown)) {
		const firstBullet = section.bullets[0];
		if (!firstBullet) continue;

		const title = stripMinimaxMarkdown(firstBullet);
		const externalId = buildMinimaxDocsExternalId(page.key, section.date, title);
		if (seen.has(externalId)) continue;
		seen.add(externalId);

		const isoDate = parseMinimaxChineseDate(section.date);
		items.push({
			externalId,
			url: buildMinimaxDocsUrl(page.path, section.date),
			title,
			summary: section.bullets.slice(1).map(stripMinimaxMarkdown).join(' ') || undefined,
			publishedAt: isoDate ? new Date(`${isoDate}T00:00:00.000Z`).toISOString() : undefined,
		});
	}

	return items;
}

export function parseMinimaxDocsMarkdown(
	markdown: string,
	page: (typeof MINIMAX_DOCS_PAGES)[number],
): RawItem[] {
	if (page.key === 'models') {
		return parseMinimaxModelsMarkdown(markdown, page);
	}
	return parseMinimaxApisMarkdown(markdown, page);
}

export async function fetchMinimaxNewsApiList(fetchFn: typeof fetch): Promise<RawItem[]> {
	const items: RawItem[] = [];
	let page = 1;

	while (true) {
		const response = await fetchFn(`${MINIMAX_NEWS_LIST_URL}?page=${page}`, {
			headers: {
				accept: 'application/json',
				'user-agent': 'beacon/1.0 (+https://github.com/d0zingcat/beacon)',
			},
		});

		if (!response.ok) {
			throw new Error(`MiniMax news fetch failed: ${response.status} ${response.statusText}`);
		}

		const payload = (await response.json()) as MinimaxNewsListResponse;
		const pageItems = parseMinimaxNewsApiList(payload.data ?? []);
		if (pageItems.length === 0) break;

		items.push(...pageItems);
		if (!payload.hasMore) break;
		page += 1;
	}

	return items;
}

export async function fetchMinimaxDocsPage(
	page: (typeof MINIMAX_DOCS_PAGES)[number],
	fetchFn: typeof fetch,
): Promise<RawItem[]> {
	const response = await fetchFn(`${MINIMAX_DOCS_URL}${page.path}.md`, {
		headers: {
			'user-agent': 'beacon/1.0 (+https://github.com/d0zingcat/beacon)',
			accept: 'text/markdown,text/plain,*/*',
		},
	});
	if (!response.ok) {
		throw new Error(
			`MiniMax docs fetch failed for ${page.path}: ${response.status} ${response.statusText}`,
		);
	}

	return parseMinimaxDocsMarkdown(await response.text(), page);
}

export async function fetchMinimaxNewsList(fetchFn: typeof fetch): Promise<RawItem[]> {
	const [newsItems, ...docsPages] = await Promise.all([
		fetchMinimaxNewsApiList(fetchFn),
		...MINIMAX_DOCS_PAGES.map((page) => fetchMinimaxDocsPage(page, fetchFn)),
	]);

	return [...newsItems, ...docsPages.flat()];
}

createSource(
	{
		id: 'minimax-news',
		name: 'MiniMax News',
		mode: 'append',
	},
	{
		kind: 'webpage',
		extract(ctx) {
			return fetchMinimaxNewsList(ctx.fetch);
		},
	},
);
