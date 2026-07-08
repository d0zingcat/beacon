import { createSource } from '../factory';
import type { RawItem } from '../types';

export const BIGMODEL_DOCS_URL = 'https://docs.bigmodel.cn';

export const BIGMODEL_NEWS_PAGES = [
	{
		key: 'new-releases',
		path: '/cn/update/new-releases',
		title: '新品发布',
	},
	{
		key: 'feature-updates',
		path: '/cn/update/feature-updates',
		title: '功能更新',
	},
] as const;

const UPDATE_BLOCK_RE =
	/<Update\s+label="([^"]+)"\s+description="([^"]+)">([\s\S]*?)<\/Update>/g;
const BULLET_RE = /^\s*[*-]\s+(.+)$/m;
const LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/;

export interface BigmodelUpdateEntry {
	date: string;
	description: string;
	body: string;
}

export function buildBigmodelNewsUrl(pagePath: string, date: string): string {
	return `${BIGMODEL_DOCS_URL}${pagePath}#${date}`;
}

export function buildBigmodelNewsExternalId(pageKey: string, date: string, description: string): string {
	return `${pageKey}:${date}:${description}`;
}

export function parseBigmodelUpdateSummary(body: string): string | undefined {
	const normalized = body
		.replace(/\r\n/g, '\n')
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line.length > 0 && !line.startsWith('['));

	for (const line of normalized) {
		const bullet = line.match(BULLET_RE);
		if (bullet?.[1]) {
			return stripBigmodelMarkdown(bullet[1]);
		}
	}

	const linkLine = normalized.find((line) => line.includes(']('));
	if (linkLine) {
		return stripBigmodelMarkdown(linkLine);
	}

	return undefined;
}

export function stripBigmodelMarkdown(text: string): string {
	return text
		.replace(LINK_RE, '$1')
		.replace(/\*\*([^*]+)\*\*/g, '$1')
		.replace(/\\_/g, '_')
		.replace(/\s+/g, ' ')
		.trim();
}

export function parseBigmodelUpdateBlocks(markdown: string): BigmodelUpdateEntry[] {
	const items: BigmodelUpdateEntry[] = [];

	for (const match of markdown.matchAll(UPDATE_BLOCK_RE)) {
		const date = match[1]?.trim();
		const description = match[2]?.trim();
		const body = match[3]?.trim() ?? '';
		if (!date || !description) continue;

		items.push({ date, description, body });
	}

	return items;
}

export function parseBigmodelNewsMarkdown(
	markdown: string,
	page: (typeof BIGMODEL_NEWS_PAGES)[number],
): RawItem[] {
	const items: RawItem[] = [];
	const seen = new Set<string>();

	for (const entry of parseBigmodelUpdateBlocks(markdown)) {
		const externalId = buildBigmodelNewsExternalId(page.key, entry.date, entry.description);
		if (seen.has(externalId)) continue;
		seen.add(externalId);

		items.push({
			externalId,
			url: buildBigmodelNewsUrl(page.path, entry.date),
			title: entry.description,
			summary: parseBigmodelUpdateSummary(entry.body),
			publishedAt: new Date(`${entry.date}T00:00:00.000Z`).toISOString(),
		});
	}

	return items;
}

export async function fetchBigmodelNewsPage(
	page: (typeof BIGMODEL_NEWS_PAGES)[number],
	fetchFn: typeof fetch,
): Promise<RawItem[]> {
	const response = await fetchFn(`${BIGMODEL_DOCS_URL}${page.path}.md`, {
		headers: {
			'user-agent': 'beacon/1.0 (+https://github.com/d0zingcat/beacon)',
			accept: 'text/markdown,text/plain,*/*',
		},
	});
	if (!response.ok) {
		throw new Error(
			`BigModel docs fetch failed for ${page.path}: ${response.status} ${response.statusText}`,
		);
	}

	return parseBigmodelNewsMarkdown(await response.text(), page);
}

export async function fetchBigmodelNewsList(fetchFn: typeof fetch): Promise<RawItem[]> {
	const results = await Promise.allSettled(
		BIGMODEL_NEWS_PAGES.map((page) => fetchBigmodelNewsPage(page, fetchFn)),
	);

	const items: RawItem[] = [];
	const errors: string[] = [];

	for (let index = 0; index < results.length; index++) {
		const result = results[index];
		const page = BIGMODEL_NEWS_PAGES[index];
		if (!result || !page) continue;

		if (result.status === 'fulfilled') {
			items.push(...result.value);
			continue;
		}

		const message =
			result.reason instanceof Error ? result.reason.message : String(result.reason);
		errors.push(message);
		console.warn(`BigModel docs page skipped (${page.path}): ${message}`);
	}

	if (items.length === 0 && errors.length > 0) {
		throw new Error(errors.join('; '));
	}

	return items;
}

createSource(
	{
		id: 'bigmodel-news',
		name: 'BigModel News',
		mode: 'append',
	},
	{
		kind: 'webpage',
		extract(ctx) {
			return fetchBigmodelNewsList(ctx.fetch);
		},
	},
);
