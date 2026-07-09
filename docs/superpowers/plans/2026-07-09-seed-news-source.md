# ByteDance Seed News Source — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Beacon source that monitors ByteDance Seed's tech blog (动态: model releases + research highlights), notifying on new items via the proven `qwen-blog.ts` pattern.

**Architecture:** A single code-registered `append` source in `src/sources/examples/seed-news.ts`. An inline `kind: 'webpage'` extractor calls `GET /api/get_article_list_v2?article_type=2` and walks the `page_token` cursor to collect every item, filters to ResearchArea 74 (模型发布) + 75 (研究成果), and maps each to a `RawItem` with English-preferred title/summary + `/en/blog/` URL. Co-located unit tests cover parse, language fallback, category filter, pagination, and error handling.

**Tech Stack:** TypeScript, Vitest (test runner, already configured), `createSource` factory (existing). No new dependencies.

## Global Constraints

- Source id `seed-news`, display name `"ByteDance Seed"`, mode `append`
- English-preferred content with zh fallback; URL uses en TitleKey with zh TitleKey fallback
- Category allowlist: ResearchAreaID `74` (模型发布) and `75` (研究成果) ONLY
- Follow the exact file/export/test shape of `src/sources/examples/qwen-blog.ts` + `qwen-blog.test.ts`
- No migration, no scheduler edit, no config change — code-registered + default hourly bucket
- Test runner: `pnpm test` (vitest). Typecheck: `pnpm typecheck`

---

## Task 1: Write tests for the Seed news parser and filter

**Files:**
- Create: `src/sources/examples/seed-news.test.ts`

**Interfaces:**
- Consumes: exports from `./seed-news` (Task 2) — `parseSeedNewsList`, `fetchSeedNews`, `normalizeSeedItem`, `SEED_NEED_AREA_IDS`
- Produces: a failing test file that Task 2's implementation must satisfy

- [ ] **Step 1: Create the test file with a realistic fixture**

Create `src/sources/examples/seed-news.test.ts`. The fixture models the real API response shape (verified against `seed.bytedance.com`): each item has `ArticleMeta` (with `ID`, `PublishDate` epoch-ms, `ResearchArea[]`), `ArticleSubContentEn`, and `ArticleSubContentZh`.

```ts
import { describe, expect, it, vi } from 'vitest';
import {
	fetchSeedNews,
	normalizeSeedItem,
	parseSeedNewsList,
	SEED_NEED_AREA_IDS,
} from './seed-news';

/**
 * Realistic Seed API response shape, modeled on the live `/api/get_article_list_v2`.
 * - id 1718  → area 74 (模型发布,Models)     → in scope
 * - id 1703  → area 75 (研究成果,Research)    → in scope
 * - id 9999  → area 79 (招聘信息,Recruitment) → filtered out
 */
const SAMPLE_RESPONSE = JSON.stringify({
	sub_article_list: [
		{
			ArticleMeta: {
				ID: 1718,
				ArticleID: 1783417209913,
				ArticleType: 2,
				Author: '',
				Status: 2,
				PublishDate: 1783468800000,
				ResearchArea: [{ ResearchAreaID: 74, ResearchAreaName: 'Models', ResearchAreaNameZh: '模型发布' }],
				Cover: '',
				Thumbnail: '',
				ExternalLinks: [],
				Journal: '',
				EditorEmail: '',
				UpdateTime: 1783440000000,
				IsPinned: false,
				ContentType: 0,
				PinTab: [],
				WorkingTeam: [],
				IsTrending: false,
				IsTeamSelect: false,
			},
			ArticleSubContentEn: {
				Title: 'Beyond Generation, It Understands Design | Introducing Seedream 5.0 Pro',
				Abstract: 'A multimodal image generation model with intelligent thinking and efficient creation.',
				TitleKey: 'beyond-generation-it-understands-design-introducing-seedream-5-0-pro',
				Cover: '',
				Thumbnail: '',
				VideoLink: '',
				BannerImage: '',
				MobileCover: '',
				HomeCover: '',
				HomeMobileCover: '',
				HomeMiniCover: '',
				HomeColorMode: 0,
				ShortTitle: '',
				ImageTitle: '',
			},
			ArticleSubContentZh: {
				Title: '不止“生成”，更懂“设计” ｜ Seedream 5.0 Pro 发布',
				Abstract: '具备智能思考、高效创作和生产的多模态图像生成模型',
				TitleKey: '不止-生成-更懂-设计-seedream-5-0-pro-发布',
				Cover: '',
				Thumbnail: '',
				VideoLink: '',
				BannerImage: '',
				MobileCover: '',
				HomeCover: '',
				HomeMobileCover: '',
				HomeMiniCover: '',
				HomeColorMode: 0,
				ShortTitle: '',
				ImageTitle: '',
			},
		},
		{
			ArticleMeta: {
				ID: 1703,
				ArticleID: 1783331213945,
				ArticleType: 2,
				Author: '',
				Status: 2,
				PublishDate: 1783209600000,
				ResearchArea: [{ ResearchAreaID: 75, ResearchAreaName: 'Research', ResearchAreaNameZh: '研究成果' }],
				Cover: '',
				Thumbnail: '',
				ExternalLinks: [],
				Journal: 'arXiv',
				EditorEmail: '',
				UpdateTime: 1783331213000,
				IsPinned: false,
				ContentType: 0,
				PinTab: [],
				WorkingTeam: [],
				IsTrending: false,
				IsTeamSelect: false,
			},
			ArticleSubContentEn: {
				Title: 'Seed Prover 1.5: Agentic Architecture for Math Reasoning',
				Abstract: 'A new agentic architecture that improves mathematical reasoning.',
				TitleKey: 'seed-prover-1-5-agentic-architecture-for-math-reasoning',
				Cover: '',
				Thumbnail: '',
				VideoLink: '',
				BannerImage: '',
				MobileCover: '',
				HomeCover: '',
				HomeMobileCover: '',
				HomeMiniCover: '',
				HomeColorMode: 0,
				ShortTitle: '',
				ImageTitle: '',
			},
			ArticleSubContentZh: {
				Title: 'Seed Prover 1.5：全新 Agentic 架构，更强数学推理表现',
				Abstract: '',
				TitleKey: 'seed-prover-1-5-全新-agentic-架构-更强数学推理表现',
				Cover: '',
				Thumbnail: '',
				VideoLink: '',
				BannerImage: '',
				MobileCover: '',
				HomeCover: '',
				HomeMobileCover: '',
				HomeMiniCover: '',
				HomeColorMode: 0,
				ShortTitle: '',
				ImageTitle: '',
			},
		},
		{
			ArticleMeta: {
				ID: 9999,
				ArticleID: 1783000000000,
				ArticleType: 2,
				Author: '',
				Status: 2,
				PublishDate: 1783123200000,
				ResearchArea: [{ ResearchAreaID: 79, ResearchAreaName: 'Recruitment', ResearchAreaNameZh: '招聘信息' }],
				Cover: '',
				Thumbnail: '',
				ExternalLinks: [],
				Journal: '',
				EditorEmail: '',
				UpdateTime: 1783267200000,
				IsPinned: false,
				ContentType: 0,
				PinTab: [],
				WorkingTeam: [],
				IsTrending: false,
				IsTeamSelect: false,
			},
			ArticleSubContentEn: {
				Title: 'We are hiring research interns',
				Abstract: 'Join our team.',
				TitleKey: 'we-are-hiring-research-interns',
				Cover: '',
				Thumbnail: '',
				VideoLink: '',
				BannerImage: '',
				MobileCover: '',
				HomeCover: '',
				HomeMobileCover: '',
				HomeMiniCover: '',
				HomeColorMode: 0,
				ShortTitle: '',
				ImageTitle: '',
			},
			ArticleSubContentZh: {
				Title: '研究实习生招聘',
				Abstract: '加入我们的团队',
				TitleKey: '研究实习生招聘',
				Cover: '',
				Thumbnail: '',
				VideoLink: '',
				BannerImage: '',
				MobileCover: '',
				HomeCover: '',
				HomeMobileCover: '',
				HomeMiniCover: '',
				HomeColorMode: 0,
				ShortTitle: '',
				ImageTitle: '',
			},
		},
	],
	next_page_token: '10',
	has_more: true,
	total: 91,
	BaseResp: { StatusMessage: 'success', StatusCode: 0 },
});

// Only the first two items survive the category filter (74 + 75).
const EXPECTED_ALL = [
	{
		externalId: 'seed-1718',
		url: 'https://seed.bytedance.com/en/blog/beyond-generation-it-understands-design-introducing-seedream-5-0-pro',
		title: 'Beyond Generation, It Understands Design | Introducing Seedream 5.0 Pro',
		summary: 'A multimodal image generation model with intelligent thinking and efficient creation.',
		publishedAt: '2026-07-08T00:00:00.000Z',
	},
	{
		externalId: 'seed-1703',
		url: 'https://seed.bytedance.com/en/blog/seed-prover-1-5-agentic-architecture-for-math-reasoning',
		title: 'Seed Prover 1.5: Agentic Architecture for Math Reasoning',
		summary: 'A new agentic architecture that improves mathematical reasoning.',
		publishedAt: '2026-07-05T00:00:00.000Z',
	},
];

describe('parseSeedNewsList', () => {
	it('maps in-scope articles (74/75) to raw items with en-preferred content and en URL', () => {
		const items = parseSeedNewsList(SAMPLE_RESPONSE);
		expect(items).toEqual(EXPECTED_ALL);
	});

	it('falls back to zh title/summary when en fields are empty', () => {
		const json = JSON.stringify({
			sub_article_list: [
				{
					ArticleMeta: {
						ID: 5,
						ArticleID: 1,
						ArticleType: 2,
						Author: '',
						Status: 2,
						PublishDate: 1783468800000,
						ResearchArea: [{ ResearchAreaID: 74, ResearchAreaName: 'Models', ResearchAreaNameZh: '模型发布' }],
						Cover: '',
						Thumbnail: '',
						ExternalLinks: [],
						Journal: '',
						EditorEmail: '',
						UpdateTime: 0,
						IsPinned: false,
						ContentType: 0,
						PinTab: [],
						WorkingTeam: [],
						IsTrending: false,
						IsTeamSelect: false,
					},
					ArticleSubContentEn: blankContent(),
					ArticleSubContentZh: {
						...blankContent(),
						Title: 'Seedance 2.0 正式发布',
						Abstract: '新一代视频生成模型',
						TitleKey: 'seedance-2-0-正式发布',
					},
				},
			],
			next_page_token: '',
			has_more: false,
			total: 1,
			BaseResp: { StatusMessage: 'success', StatusCode: 0 },
		});
		const [item] = parseSeedNewsList(json);
		expect(item?.title).toBe('Seedance 2.0 正式发布');
		expect(item?.summary).toBe('新一代视频生成模型');
		// URL slug falls back to zh TitleKey when en TitleKey is empty
		expect(item?.url).toBe('https://seed.bytedance.com/en/blog/seedance-2-0-正式发布');
	});

	it('falls back to zh TitleKey for the URL when en TitleKey is missing', () => {
		const json = JSON.stringify({
			sub_article_list: [
				{
					ArticleMeta: {
						ID: 9,
						ArticleID: 1,
						ArticleType: 2,
						Author: '',
						Status: 2,
						PublishDate: 1783468800000,
						ResearchArea: [{ ResearchAreaID: 75, ResearchAreaName: 'Research', ResearchAreaNameZh: '研究成果' }],
						Cover: '',
						Thumbnail: '',
						ExternalLinks: [],
						Journal: '',
						EditorEmail: '',
						UpdateTime: 0,
						IsPinned: false,
						ContentType: 0,
						PinTab: [],
						WorkingTeam: [],
						IsTrending: false,
						IsTeamSelect: false,
					},
					ArticleSubContentEn: { ...blankContent(), Title: 'Only English Title' },
					ArticleSubContentZh: { ...blankContent(), TitleKey: 'chinese-slug' },
				},
			],
			next_page_token: '',
			has_more: false,
			total: 1,
			BaseResp: { StatusMessage: 'success', StatusCode: 0 },
		});
		const [item] = parseSeedNewsList(json);
		expect(item?.url).toBe('https://seed.bytedance.com/en/blog/chinese-slug');
	});

	it('filters out articles outside ResearchArea 74 and 75', () => {
		const items = parseSeedNewsList(SAMPLE_RESPONSE);
		// 3 items in fixture, only 2 survive (area 79 Recruitment dropped)
		expect(items).toHaveLength(2);
		expect(items.map((i) => i.externalId)).toEqual(['seed-1718', 'seed-1703']);
	});

	it('treats an article with an empty/missing ResearchArea as out of scope', () => {
		const json = JSON.stringify({
			sub_article_list: [
				{
					ArticleMeta: {
						ID: 7,
						ArticleID: 1,
						ArticleType: 2,
						Author: '',
						Status: 2,
						PublishDate: 1783468800000,
						ResearchArea: [],
						Cover: '',
						Thumbnail: '',
						ExternalLinks: [],
						Journal: '',
						EditorEmail: '',
						UpdateTime: 0,
						IsPinned: false,
						ContentType: 0,
						PinTab: [],
						WorkingTeam: [],
						IsTrending: false,
						IsTeamSelect: false,
					},
					ArticleSubContentEn: { ...blankContent(), Title: 'No category' },
					ArticleSubContentZh: blankContent(),
				},
			],
			next_page_token: '',
			has_more: false,
			total: 1,
			BaseResp: { StatusMessage: 'success', StatusCode: 0 },
		});
		expect(parseSeedNewsList(json)).toEqual([]);
	});

	it('returns an empty list for ill-formed JSON payloads', () => {
		expect(parseSeedNewsList('not json')).toEqual([]);
		expect(parseSeedNewsList('{}')).toEqual([]);
		expect(parseSeedNewsList('{"sub_article_list":"no"}')).toEqual([]);
	});

	it('drops items with a zero / missing id', () => {
		const json = JSON.stringify({
			sub_article_list: [
				{
					ArticleMeta: {
						ID: 0,
						ArticleID: 1,
						ArticleType: 2,
						Author: '',
						Status: 2,
						PublishDate: 1783468800000,
						ResearchArea: [{ ResearchAreaID: 74, ResearchAreaName: 'Models', ResearchAreaNameZh: '模型发布' }],
						Cover: '',
						Thumbnail: '',
						ExternalLinks: [],
						Journal: '',
						EditorEmail: '',
						UpdateTime: 0,
						IsPinned: false,
						ContentType: 0,
						PinTab: [],
						WorkingTeam: [],
						IsTrending: false,
						IsTeamSelect: false,
					},
					ArticleSubContentEn: { ...blankContent(), Title: 'Has id zero' },
					ArticleSubContentZh: blankContent(),
				},
			],
			next_page_token: '',
			has_more: false,
			total: 1,
			BaseResp: { StatusMessage: 'success', StatusCode: 0 },
		});
		expect(parseSeedNewsList(json)).toEqual([]);
	});
});

describe('normalizeSeedItem', () => {
	it('strips markdown from the summary and collapses whitespace', () => {
		const item = {
			...EXPECTED_ALL[0],
			summary: '**bold** *italic* `code` [API](https://x) and   extra   spaces',
		};
		expect(normalizeSeedItem(item).summary).toBe('bold italic code API and extra spaces');
	});

	it('leaves an already-clean summary untouched', () => {
		const item = { ...EXPECTED_ALL[0] };
		expect(normalizeSeedItem(item).summary).toBe(item.summary);
	});
});

describe('fetchSeedNews', () => {
	it('fetches the Seed list API and parses the body via a single-page response', async () => {
		const fetchFn = vi
			.fn()
			.mockResolvedValue(
				new Response(SAMPLE_RESPONSE, { status: 200, headers: { 'content-type': 'application/json' } }),
			);
		const items = await fetchSeedNews(fetchFn as unknown as typeof fetch);

		expect(fetchFn).toHaveBeenCalledWith(
			'https://seed.bytedance.com/api/get_article_list_v2?article_type=2&order_desc=true&count=100&page_token=0',
			expect.objectContaining({
				headers: expect.objectContaining({ accept: 'application/json', 'x-tt-locale': 'US' }),
			}),
		);
		expect(items).toEqual(EXPECTED_ALL);
	});

	it('walks the page_token cursor until has_more is false', async () => {
		const page1 = JSON.stringify({
			sub_article_list: [
				{
					ArticleMeta: {
						ID: 1718,
						ArticleID: 1,
						ArticleType: 2,
						Author: '',
						Status: 2,
						PublishDate: 1783468800000,
						ResearchArea: [{ ResearchAreaID: 74, ResearchAreaName: 'Models', ResearchAreaNameZh: '模型发布' }],
						Cover: '',
						Thumbnail: '',
						ExternalLinks: [],
						Journal: '',
						EditorEmail: '',
						UpdateTime: 0,
						IsPinned: false,
						ContentType: 0,
						PinTab: [],
						WorkingTeam: [],
						IsTrending: false,
						IsTeamSelect: false,
					},
					ArticleSubContentEn: {
						...blankContent(),
						Title: 'First',
						Abstract: 'a',
						TitleKey: 'first',
					},
					ArticleSubContentZh: blankContent(),
				},
			],
			next_page_token: '100',
			has_more: true,
			total: 2,
			BaseResp: { StatusMessage: 'success', StatusCode: 0 },
		});
		const page2 = JSON.stringify({
			sub_article_list: [
				{
					ArticleMeta: {
						ID: 1703,
						ArticleID: 1,
						ArticleType: 2,
						Author: '',
						Status: 2,
						PublishDate: 1783209600000,
						ResearchArea: [{ ResearchAreaID: 75, ResearchAreaName: 'Research', ResearchAreaNameZh: '研究成果' }],
						Cover: '',
						Thumbnail: '',
						ExternalLinks: [],
						Journal: '',
						EditorEmail: '',
						UpdateTime: 0,
						IsPinned: false,
						ContentType: 0,
						PinTab: [],
						WorkingTeam: [],
						IsTrending: false,
						IsTeamSelect: false,
					},
					ArticleSubContentEn: {
						...blankContent(),
						Title: 'Second',
						Abstract: 'b',
						TitleKey: 'second',
					},
					ArticleSubContentZh: blankContent(),
				},
			],
			next_page_token: '200',
			has_more: false,
			total: 2,
			BaseResp: { StatusMessage: 'success', StatusCode: 0 },
		});
		const fetchFn = vi
			.fn()
			.mockResolvedValueOnce(new Response(page1, { status: 200 }))
			.mockResolvedValueOnce(new Response(page2, { status: 200 }));

		const items = await fetchSeedNews(fetchFn as unknown as typeof fetch);

		expect(fetchFn).toHaveBeenCalledTimes(2);
		// second call must use the cursor returned by the first
		expect(fetchFn.mock.calls[1][0]).toContain('page_token=100');
		expect(items.map((i) => i.externalId)).toEqual(['seed-1718', 'seed-1703']);
	});

	it('stops at a safety cap even when has_more stays true', async () => {
		const page = JSON.stringify({
			sub_article_list: [],
			next_page_token: 'next',
			has_more: true,
			total: 9999,
			BaseResp: { StatusMessage: 'success', StatusCode: 0 },
		});
		const fetchFn = vi
			.fn()
			.mockResolvedValue(new Response(page, { status: 200 }));
		await fetchSeedNews(fetchFn as unknown as typeof fetch);
		// cap is 10 pages → fetchFn called at most 10 times, not unbounded
		expect(fetchFn.mock.calls.length).toBeLessThanOrEqual(10);
		expect(fetchFn.mock.calls.length).toBeGreaterThan(0);
	});

	it('throws when the endpoint returns a non-ok status', async () => {
		const fetchFn = vi.fn().mockResolvedValue(new Response('', { status: 503 }));
		await expect(fetchSeedNews(fetchFn as unknown as typeof fetch)).rejects.toThrow(
			'Seed news fetch failed: 503',
		);
	});
});

describe('SEED_NEED_AREA_IDS', () => {
	it('exactly contains the model-release and research area ids', () => {
		expect(SEED_NEED_AREA_IDS).toEqual(new Set([74, 75]));
	});
});

function blankContent() {
	return {
		Title: '',
		Abstract: '',
		TitleKey: '',
		Cover: '',
		Thumbnail: '',
		VideoLink: '',
		BannerImage: '',
		MobileCover: '',
		HomeCover: '',
		HomeMobileCover: '',
		HomeMiniCover: '',
		HomeColorMode: 0,
		ShortTitle: '',
		ImageTitle: '',
	};
}
```

- [ ] **Step 2: Run the tests and verify they fail (no implementation yet)**

Run: `pnpm test src/sources/examples/seed-news.test.ts`
Expected: FAIL — `Cannot find module './seed-news'`. This confirms the tests are wired against the right exports and Task 2's implementation must satisfy them.

- [ ] **Step 3: Commit the failing tests**

```bash
git add src/sources/examples/seed-news.test.ts
git commit -m "test(seed-news): add failing tests for Seed news parser, filter, pagination"
```

---

## Task 2: Implement the Seed news source

**Files:**
- Create: `src/sources/examples/seed-news.ts`

**Interfaces:**
- Consumes: the export contract the tests in Task 1 import — `parseSeedNewsList`, `fetchSeedNews`, `normalizeSeedItem`, `SEED_NEED_AREA_IDS`
- Produces: a registered source with id `seed-news`, name `"ByteDance Seed"`, `mode: 'append'`

- [ ] **Step 1: Create the source file**

Create `src/sources/examples/seed-news.ts`:

```ts
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
	return `${SEED_SITE_URL}/blog/${encodeURIComponent(slug ?? '')}`;
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
		.replace(/\*([^*]+)\*\*/g, '$1')
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

		const json = await response.text();
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
```

- [ ] **Step 2: Run the tests and verify they pass**

Run: `pnpm test src/sources/examples/seed-news.test.ts`
Expected: ALL PASS. If any fail, fix the implementation in `seed-news.ts` (do not weaken tests) until green.

- [ ] **Step 3: Commit the implementation**

```bash
git add src/sources/examples/seed-news.ts
git commit -m "feat(seed-news): add ByteDance Seed news source"
```

---

## Task 3: Register the source and verify the full test + typecheck suite

**Files:**
- Modify: `src/sources/examples/index.ts`

**Interfaces:**
- Consumes: the `seed-news` source registered as a side-effect in Task 2
- Produces: a source that the scheduler picks up in the default hourly bucket

- [ ] **Step 1: Add the barrel import**

In `src/sources/examples/index.ts`, add `import './seed-news';` at the end of the import list (after the deepseek-updates line):

```ts
import './cursor-changelog';
import './cursor-blog';
import './anthropic-blog';
import './bedrock-models';
import './dmit-stock';
import './hy-news';
import './mimo-news';
import './bigmodel-news';
import './minimax-news';
import './kimi-blog';
import './qwen-blog';
import './longcat-research';
import './gemini-blog';
import './deepseek-news';
import './deepseek-updates';
import './seed-news';
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: no errors. Fix any type errors before continuing.

- [ ] **Step 3: Run the seed-news test suite one final time**

Run: `pnpm test src/sources/examples/seed-news.test.ts`
Expected: ALL PASS.

- [ ] **Step 4: Run the broader example test suite to confirm no regressions**

Run: `pnpm test src/sources/examples/`
Expected: ALL PASS (the new source is registered as a side-effect on import, so this also confirms registration doesn't throw at module load).

- [ ] **Step 5: Commit**

```bash
git add src/sources/examples/index.ts
git commit -m "feat(seed-news): register seed-news source in examples barrel"
```

---

## Out of Scope (per spec)

- `article_type=1` (research papers) — separate concern
- DB-loaded / feed registration — code-registered, no migration
- Browser Rendering — unnecessary with the JSON API
- Scheduler tuning — default hourly bucket is fine
