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
