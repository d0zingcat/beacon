# ByteDance Seed News Source — Design

**Date:** 2026-07-09
**Status:** Draft for review

## Goal

Add a Beacon source that monitors ByteDance Seed's tech blog (动态: model releases + research highlights) at `https://seed.bytedance.com/zh/blog`, notifying on new items.

## Background

ByteDance Seed's blog (`seed.bytedance.com`) is a client-side rendered SPA whose HTML shell contains no article data. Behind it is a stable JSON API that the site itself uses:

```
GET /api/get_article_list_v2?article_type=2&order_desc=true&count=100&page_token={token}
```

The page the user identified (`/zh/blog`) is the "技术博客" (tech blog) entry-point. The API's `article_type=2` returns 动态 (updates) — model releases, research highlights, and a few job postings/team-news items.

**Verification:** confirmed live that `article_type=2` returns ~91 items with cursor pagination (`next_page_token` / `has_more`); `article_type=1` is research papers (not in scope).

## Decisions

| Topic | Decision | Rationale |
|-------|----------|-----------|
| Content scope | `article_type=2`, only ResearchArea 74 (模型发布) + 75 (研究成果) | Matches "blog & news"; excludes 招聘信息 (Recruitment) and other noise the user doesn't want |
| Extractor mechanism | Inline `kind: 'webpage'` over the JSON API | Exact `qwen-blog.ts` pattern; API is stable and complete. Ruled out Browser Rendering (heavy, fragile — overkill with a working JSON API) |
| Content language | English title/summary preferred, zh fallback | Model names are canonical in English (Seedream, Seedance, etc.) |
| Article URL | `/en/blog/{enTitleKey}` | English slug under the en locale; resolvable, matches English-preferred content |
| Display name | `ByteDance Seed` | User's choice — recognisable parent brand |
| Source id | `seed-news` | Unique dedupe key, fits naming convention |
| Pagination | Walk cursor to completion, safety cap 10 pages | Ensures full capture each crawl; cap prevents runaway loops |

## Type-2 category map (verified)

| ResearchAreaID | Name (zh) | Name (en) | In scope? |
|----------------|-----------|-----------|-----------|
| 74 | 模型发布 | Models | ✅ include |
| 75 | 研究成果 | Research | ✅ include |
| 80 | 学术活动 | Conferences | ❌ exclude |
| 79 | 招聘信息 | Recruitment | ❌ exclude |
| 77 | 团队动态 | Team News | ❌ exclude |
| 78 | 学术合作 | Partnership | ❌ exclude |

## Source registration

```ts
// src/sources/examples/seed-news.ts
createSource(
  {
    id: 'seed-news',
    name: 'ByteDance Seed',
    mode: 'append',
    normalize: normalizeSeedItem,
  },
  { kind: 'webpage', extract: (ctx) => fetchAllSeedNews(ctx.fetch) },
);
```

Plus `import './seed-news';` in `src/sources/examples/index.ts`. Default hourly scheduler bucket — no scheduler edits needed.

## Extractor design

### Fetch + pagination

`fetchAllSeedNews(fetchFn)`:
1. `page_token = '0'`, `items = []`
2. Loop: `GET https://seed.bytedance.com/api/get_article_list_v2?article_type=2&order_desc=true&count=100&page_token={page_token}` with headers `{ 'user-agent': USER_AGENT, 'accept': 'application/json', 'x-tt-locale': 'US' }` — the `x-tt-locale: US` header makes the API populate `ArticleSubContentEn` (without it the en fields come back empty)
3. Push `sub_article_list` → `items`; advance `page_token = next_page_token`
4. Stop when `has_more=false` or safety cap (10 pages) hit
5. Return `items`

### Per-item mapping → RawItem

- `externalId`: `seed-${ArticleMeta.ID}` (stable numeric ID)
- `url`: `https://seed.bytedance.com/en/blog/${ArticleSubContentEn.TitleKey}`
- `title`: `ArticleSubContentEn.Title` ?? `ArticleSubContentZh.Title` (en preferred)
- `summary`: en abstract ?? zh abstract, markdown-stripped, capped at 280 chars (same convention as `qwen-blog.ts`)
- `publishedAt`: `ArticleMeta.PublishDate` (epoch ms → ISO 8601)

### Category filter

Allowlist constant: `SEED_NEED_AREA_IDS = new Set([74, 75])`. Emit item only if any `ArticleMeta.ResearchArea[].ResearchAreaID` is in the set.

### Normalize

`normalizeSeedItem`: strip residual markdown from summary (same approach as `qwen-blog.ts`), collapse whitespace. Applied via the `normalize` hook on `createSource`.

## Files

| File | Action |
|------|--------|
| `src/sources/examples/seed-news.ts` | **create** — extractor + source |
| `src/sources/examples/index.ts` | **edit** — add `import './seed-news'` |
| `src/sources/examples/seed-news.test.ts` | **create** — unit tests |

## Tests

Co-located `seed-news.test.ts` (matching repo pattern):
- `parseSeedNewsList` on a fixture JSON → correct RawItem[] shape
- en-preferred title/summary with zh fallback
- items outside ResearchArea 74/75 are filtered out
- empty / ill-formed payload degrades to `[]`

## Out of scope

- `article_type=1` (research papers) — separate concern, higher volume, academic rather than news
- DB-loaded / feed-style registration — this is code-registered, no migration needed
- Browser Rendering — unnecessary given the JSON API
- Scheduler tuning — default hourly bucket is fine
