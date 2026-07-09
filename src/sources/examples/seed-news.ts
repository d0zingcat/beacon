import { createSource } from '../factory';
import type { RawItem } from '../types';

export const SEED_SITE_URL = 'https://seed.bytedance.com';

/**
 * Seed's 动态 (updates) split into research areas. Only model releases and
 * research highlights are "blog & news" — we drop hiring, team news, etc.
 * Verified against /api/get_article_list_v2 (article_type=2).
 */
export const SEED_NEED_AREA_IDS = new Set([74, 75]);

const LIST_URL = `${SEED_SITE_URL}/api/get_article_list_v2`;
const USER_AGENT = 'beacon/1.0 (+https://github.com/d0zingcat/beacon)';
/** Stop walking the cursor after this many pages even if has_more stays true. */
const MAX_PAGES = 10;

/** One article list page as returned by the Seed API. */
export interface SeedListResponse {
	sub_article_list: SeedArticle[];
	next_page_token: string;
	has_more: boolean;
	total: number;
	BaseResp: { StatusMessage: string; StatusCode: number };
}

/** Seed's bilingual content block (either en or zh populated, depending on locale header). */
export interface SeedContent {
	Title: string;
	Abstract: string;
	TitleKey: string;
	Cover: string;
	Thumbnail: string;
	VideoLink: string;
	BannerImage: string;
	MobileCover: string;
	HomeCover: string;
	HomeMobileCover: string;
	HomeMiniCover: string;
	HomeColorMode: number;
	ShortTitle: string;
	ImageTitle: string;
}

export interface SeedArticle {
	ArticleMeta: {
		ID: number;
		ArticleID: number;
		ArticleType: number;
		Author: string;
		Status: number;
		PublishDate: number;
		ResearchArea: { ResearchAreaID: number; ResearchAreaName: string; ResearchAreaNameZh: string }[];
		Cover: string;
		Thumbnail: string;
		ExternalLinks: { ExternalLinkType: number; Link: string }[];
		Journal: string;
		EditorEmail: string;
		UpdateTime: number;
		IsPinned: boolean;
		ContentType: number;
		PinTab: unknown[];
		WorkingTeam: { ID: number; Name: string; NameZh: string }[];
		IsTrending: boolean;
		IsTeamSelect: boolean;
	};
	ArticleSubContentEn: SeedContent;
	ArticleSubContentZh: SeedContent;
}

/** Prefer English; fall back to Chinese when the en field is empty. */
function pickEnZh(en: string | undefined, zh: string | undefined): string | undefined {
	return en?.trim() || zh?.trim() || undefined;
}

/** Build the article URL — en locale with the en slug, falling back to zh slug. */
function buildArticleUrl(article: SeedArticle): string {
	const slug = article.ArticleSubContentEn.TitleKey?.trim() || article.ArticleSubContentZh.TitleKey?.trim();
	return `${SEED_SITE_URL}/en/blog/${slug ?? ''}`;
}

/** True if the article belongs to one of the in-scope research areas. */
function isInScope(article: SeedArticle): boolean {
	return article.ArticleMeta.ResearchArea?.some((area) => SEED_NEED_AREA_IDS.has(area.ResearchAreaID)) ?? false;
}

/** Convert epoch-ms PublishDate to ISO 8601; undefined if missing/invalid. */
function parseSeedDate(epochMs: number | undefined): string | undefined {
	if (!epochMs && epochMs !== 0) return undefined;
	const date = new Date(epochMs);
	return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function stripMarkdown(text: string): string {
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

const MAX_SUMMARY_LENGTH = 280;

function truncateSummary(text: string): string {
	return text.length > MAX_SUMMARY_LENGTH ? `${text.slice(0, 277)}...` : text;
}

/** Public for testing — parse one API page payload into in-scope RawItems. */
export function parseSeedNewsList(json: string): RawItem[] {
	let payload: unknown;
	try {
		payload = JSON.parse(json);
	} catch {
		return [];
	}

	const maybe = payload as Partial<SeedListResponse>;
	const articles = maybe?.sub_article_list;
	if (!Array.isArray(articles)) return [];

	const items: RawItem[] = [];

	for (const article of articles) {
		const meta = article?.ArticleMeta;
		if (!meta) continue;
		// A falsy ID (0, null, undefined) means an unstable externalId — skip.
		// Real Seed IDs are always large positive integers.
		if (!meta.ID) continue;
		if (!isInScope(article)) continue;

		const title = pickEnZh(article.ArticleSubContentEn?.Title, article.ArticleSubContentZh?.Title);
		if (!title) continue;

		const summaryRaw = pickEnZh(article.ArticleSubContentEn?.Abstract, article.ArticleSubContentZh?.Abstract);

		items.push({
			externalId: `seed-${meta.ID}`,
			url: buildArticleUrl(article),
			title,
			summary: summaryRaw ? truncateSummary(stripMarkdown(summaryRaw)) : undefined,
			publishedAt: parseSeedDate(meta.PublishDate),
		});
	}

	return items;
}

/** Public for testing — fetch all pages, returning every in-scope item. */
export async function fetchSeedNews(fetchFn: typeof fetch): Promise<RawItem[]> {
	const all: RawItem[] = [];
	let pageToken = '0';

	for (let page = 0; page < MAX_PAGES; page++) {
		const url = `${LIST_URL}?article_type=2&order_desc=true&count=100&page_token=${encodeURIComponent(pageToken)}`;
		const response = await fetchFn(url, {
			headers: {
				'user-agent': USER_AGENT,
				accept: 'application/json',
				// populates ArticleSubContentEn; without it the en fields come back empty
				'x-tt-locale': 'US',
			},
		});
		if (!response.ok) {
			throw new Error(`Seed news fetch failed: ${response.status} ${response.statusText}`);
		}

		let json: string;
		try {
			json = await response.text();
		} catch {
			// Body unreadable (e.g. already consumed) — stop walking rather than crash.
			break;
		}
		const items = parseSeedNewsList(json);
		all.push(...items);

		const payload = JSON.parse(json) as SeedListResponse;
		if (!payload.has_more) break;
		pageToken = payload.next_page_token;
	}

	return all;
}

/** Normalize hook — strip any residual markdown and collapse whitespace in the summary. */
export function normalizeSeedItem(raw: RawItem): Omit<RawItem, 'raw'> {
	const summary = raw.summary ? stripMarkdown(raw.summary) : undefined;
	return summary === raw.summary ? raw : { ...raw, summary };
}

createSource(
	{
		id: 'seed-news',
		name: 'ByteDance Seed',
		mode: 'append',
		normalize: normalizeSeedItem,
	},
	{
		kind: 'webpage',
		extract(ctx) {
			return fetchSeedNews(ctx.fetch);
		},
	},
);
