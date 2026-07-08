import { createSource } from '../factory';
import type { RawItem } from '../types';

export const QWEN_SITE_URL = 'https://qwen.ai';

/**
 * Qwen's `/research` page is a fully client-side rendered SPA. The article
 * list is fetched at runtime from the v2 article-retrieval API, whose
 * `type=qwen_ai` channel is the canonical English blog feed. The older
 * `page_config?code=research.research-list` endpoint is frozen.
 */
export const QWEN_BLOG_LIST_URL = `${QWEN_SITE_URL}/api/v2/article/retrieval?type=qwen_ai&language=en-US`;
const USER_AGENT = 'beacon/1.0 (+https://github.com/d0zingcat/beacon)';

/** A single article as returned by the v2 retrieval API. */
export interface QwenArticle {
	id: string;
	title: string;
	path: string;
	extra: {
		date?: string;
		description?: string;
		introduction?: string;
		tags?: string[];
	};
}

/** The full payload shape of the v2 retrieval endpoint. */
export interface QwenBlogListResponse {
	data: {
		articles: QwenArticle[];
	};
}

export function buildQwenBlogUrl(path: string): string {
	return `${QWEN_SITE_URL}/research/${encodeURIComponent(path)}`;
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
	const description = article.extra.description?.trim();
	if (description) return stripQwenMarkdown(description);

	const introduction = article.extra.introduction?.trim();
	if (!introduction) return undefined;

	const stripped = stripQwenMarkdown(introduction);
	return stripped.length > 280 ? `${stripped.slice(0, 277)}...` : stripped;
}

export function parseQwenDate(value?: string): string | undefined {
	if (!value) return undefined;
	const parsed = new Date(value);
	return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

/** Unwrap the v2 retrieval envelope — tolerate either `{ data: { articles } }`
 *  or a bare array payload so a mistaken endpoint keeps degrading cleanly. */
function extractQwenArticles(payload: unknown): QwenArticle[] {
	if (Array.isArray(payload)) return payload as QwenArticle[];

	const maybe = payload as Partial<QwenBlogListResponse>;
	const articles = maybe?.data?.articles;
	return Array.isArray(articles) ? articles : [];
}

export function parseQwenBlogList(json: string): RawItem[] {
	let payload: unknown;
	try {
		payload = JSON.parse(json);
	} catch {
		return [];
	}

	const items: RawItem[] = [];
	const seen = new Set<string>();

	for (const article of extractQwenArticles(payload)) {
		const id = article?.id?.trim();
		const title = article?.title?.trim();
		const path = article?.path?.trim();
		if (!id || !title || !path) continue;
		if (seen.has(id)) continue;
		seen.add(id);

		items.push({
			externalId: id,
			url: buildQwenBlogUrl(path),
			title,
			summary: pickQwenSummary(article),
			publishedAt: parseQwenDate(article.extra.date),
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
