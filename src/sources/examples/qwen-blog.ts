import { createSource } from '../factory';
import type { RawItem } from '../types';

export const QWEN_SITE_URL = 'https://qwen.ai';

/**
 * The `/research` page on qwen.ai is a fully client-side rendered SPA whose
 * article list is fetched at runtime from the page-config API. The
 * `research.research-list` code returns the full research blog index as a JSON
 * array, which is the canonical Qwen blog feed (newer than the frozen
 * qwenlm.github.io mirror).
 */
export const QWEN_BLOG_LIST_URL = `${QWEN_SITE_URL}/api/page_config?code=research.research-list`;
const USER_AGENT = 'beacon/1.0 (+https://github.com/d0zingcat/beacon)';

export interface QwenArticle {
	id: string;
	title: string;
	date?: string;
	description?: string;
	introduction?: string;
	tags?: string[];
}

export function buildQwenBlogUrl(id: string): string {
	return `${QWEN_SITE_URL}/blog?id=${encodeURIComponent(id)}`;
}

export function stripQwenMarkdown(text: string): string {
	return text
		.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
		.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
		.replace(/\*\*([^*]+)\*\*/g, '$1')
		.replace(/\*([^*]+)\*/g, '$1')
		.replace(/`([^`]+)`/g, '$1')
		.replace(/_{2}([^_]+)_{2}/g, '$1')
		.replace(/~~([^~]+)~~/g, '$1')
		.replace(/^#{1,6}\s+/gm, '')
		.replace(/^>\s?/gm, '')
		.replace(/\s+/g, ' ')
		.trim();
}

export function pickQwenSummary(article: QwenArticle): string | undefined {
	const description = article.description?.trim();
	if (description) return stripQwenMarkdown(description);

	const introduction = article.introduction?.trim();
	if (!introduction) return undefined;

	const stripped = stripQwenMarkdown(introduction);
	return stripped.length > 280 ? `${stripped.slice(0, 277)}...` : stripped;
}

export function parseQwenDate(value?: string): string | undefined {
	if (!value) return undefined;
	const parsed = new Date(value);
	return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

export function parseQwenBlogList(json: string): RawItem[] {
	let data: unknown;
	try {
		data = JSON.parse(json);
	} catch {
		return [];
	}
	if (!Array.isArray(data)) return [];

	const items: RawItem[] = [];
	const seen = new Set<string>();

	for (const entry of data) {
		const article = entry as QwenArticle;
		const id = article?.id?.trim();
		const title = article?.title?.trim();
		if (!id || !title) continue;
		if (seen.has(id)) continue;
		seen.add(id);

		items.push({
			externalId: id,
			url: buildQwenBlogUrl(id),
			title,
			summary: pickQwenSummary(article),
			publishedAt: parseQwenDate(article.date),
		});
	}

	return items;
}

export async function fetchQwenBlogList(fetchFn: typeof fetch): Promise<RawItem[]> {
	const response = await fetchFn(QWEN_BLOG_LIST_URL, {
		headers: {
			'user-agent': USER_AGENT,
			accept: 'application/json',
		},
	});
	if (!response.ok) {
		throw new Error(`Qwen blog fetch failed: ${response.status} ${response.statusText}`);
	}

	return parseQwenBlogList(await response.text());
}

createSource(
	{
		id: 'qwen-blog',
		name: 'Qwen Blog',
		mode: 'append',
	},
	{
		kind: 'webpage',
		extract(ctx) {
			return fetchQwenBlogList(ctx.fetch);
		},
	},
);
