import { createSource } from '../factory';
import type { RawItem } from '../types';

export const MIMO_SITE_URL = 'https://mimo.xiaomi.com';
export const MIMO_CDN_BASE = 'https://cdn.cnbj1.fds.api.mi-img.com/aife/mimo-blog-fe/doc_build';

const ASYNC_CHUNK_MAP_RE =
	/t\.u=e=>"static\/js\/async\/"\+e\+"\."\s*\+\s*\(\{([^}]+)\}/;
const BLOG_ROUTE_RE = /\{path:"(\/blog\/[^"]+)"[^}]*preload:async\(\)=>/g;
const SKIPPED_BLOG_PATHS = new Set(['/blog/', '/blog/blog1']);

export interface MimoBlogRoute {
	routePath: string;
	slug: string;
	chunkIds: string[];
}

export interface MimoFrontmatter {
	title: string;
	date?: string;
	summary?: string;
}

export function resolveMimoAssetUrl(path: string, cdnBase = MIMO_CDN_BASE): string {
	if (path.startsWith('http://') || path.startsWith('https://')) {
		return path;
	}
	const normalized = path.replace(/^\//, '');
	return `${cdnBase}/${normalized}`;
}

export function parseAsyncChunkMap(indexJs: string): Record<string, string> {
	const match = indexJs.match(ASYNC_CHUNK_MAP_RE);
	if (!match) {
		throw new Error('MiMo async chunk map not found in index bundle');
	}
	return Object.fromEntries([...match[1].matchAll(/(\d+):"([a-f0-9]+)"/g)].map(([, id, hash]) => [id, hash]));
}

export function discoverMimoBundlePaths(homeHtml: string): { indexPath: string; routesPath: string } {
	const scripts = [...homeHtml.matchAll(/static\/js\/([^"]+\.js)/g)].map((match) => match[1]);
	const indexScript = scripts.find((script) => /^index\.[a-f0-9]+\.js$/.test(script));
	const routesScript = scripts.find(
		(script) => /^\d+\.[a-f0-9]+\.js$/.test(script) && !script.startsWith('index.'),
	);
	if (!indexScript || !routesScript) {
		throw new Error('MiMo bundle scripts not found on homepage');
	}
	return {
		indexPath: `static/js/${indexScript}`,
		routesPath: `static/js/${routesScript}`,
	};
}

export function parseMimoBlogRoutes(routesJs: string): MimoBlogRoute[] {
	const routes: MimoBlogRoute[] = [];

	for (const match of routesJs.matchAll(BLOG_ROUTE_RE)) {
		const path = match[1];
		const start = match.index ?? 0;
		const end = routesJs.indexOf(',lang:"en",version:""', start);
		if (end === -1 || SKIPPED_BLOG_PATHS.has(path)) {
			continue;
		}

		const block = routesJs.slice(start, end);
		if (block.includes('lang:"zh"')) {
			continue;
		}

		const preload = block.split('preload:async()=>', 2)[1] ?? '';
		const chunkIds = [...preload.matchAll(/t\.e\("(\d+)"\)/g)].map((chunk) => chunk[1]);
		if (chunkIds.length === 0) {
			continue;
		}

		routes.push({
			routePath: path,
			slug: path.replace(/^\/blog\//, ''),
			chunkIds,
		});
	}

	return routes;
}

export function decodeMimoJsString(value: string): string {
	return value
		.replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
		.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
		.replace(/\\n/g, '\n')
		.replace(/\\"/g, '"')
		.replace(/\\\\/g, '\\');
}

export function parseMimoFrontmatter(chunkJs: string): MimoFrontmatter | null {
	const match = chunkJs.match(/frontmatter:\{([^}]+)\}/);
	if (!match) {
		return null;
	}

	const body = match[1];
	const titleMatch = body.match(/title:"((?:\\.|[^"\\])*)"/);
	const dateMatch = body.match(/date:"([^"]*)"/);
	const summaryMatch = body.match(/description:"((?:\\.|[^"\\])*)"/);
	if (!titleMatch?.[1]?.trim()) {
		return null;
	}

	return {
		title: decodeMimoJsString(titleMatch[1]).trim(),
		date: dateMatch?.[1],
		summary: summaryMatch?.[1] ? decodeMimoJsString(summaryMatch[1]).trim() : undefined,
	};
}

export function slugToMimoTitle(slug: string): string {
	const parts = slug.split('-');
	const result: string[] = [];

	for (let index = 0; index < parts.length; index += 1) {
		const part = parts[index];
		if (!part) continue;

		if (part === 'mimo') {
			result.push('MiMo');
			continue;
		}

		if (part === 'v2' && /^\d+$/.test(parts[index + 1] ?? '')) {
			result.push(`V2.${parts[index + 1]}`);
			index += 1;
			continue;
		}

		if (/^v\d/.test(part)) {
			result.push(part.toUpperCase());
			continue;
		}

		if (/^\d+tps$/.test(part)) {
			result.push(part.toUpperCase());
			continue;
		}

		if (part === 'asr' || part === 'tts') {
			result.push(part.toUpperCase());
			continue;
		}

		result.push(part.charAt(0).toUpperCase() + part.slice(1));
	}

	return result.join(' ');
}

export function buildMimoSiteUrl(path: string): string {
	const normalized = path.startsWith('/') ? path : `/${path}`;
	return `${MIMO_SITE_URL}${normalized}`;
}

/** Rspress cleanUrls normalization (route.cleanUrls is true on mimo.xiaomi.com). */
export function normalizeMimoCleanUrl(path: string, cleanUrls = true): string {
	if (!path) return '/';
	const hashIndex = path.indexOf('#');
	const url = hashIndex === -1 ? path : path.slice(0, hashIndex);
	const hash = hashIndex === -1 ? '' : path.slice(hashIndex);

	let normalized = url;
	if (!cleanUrls) {
		if (normalized.endsWith('/')) normalized += 'index.html';
		else normalized += '.html';
	} else {
		if (normalized.endsWith('/')) normalized += 'index';
		if (normalized.endsWith('.html')) normalized = normalized.replace(/\.html$/, '');
	}

	const withLeadingSlash = normalized.startsWith('/') ? normalized : `/${normalized}`;
	return hash ? `${withLeadingSlash}${hash}` : withLeadingSlash;
}

/** Build public URL candidates from the route path embedded in Rspress bundles. */
export function buildMimoUrlCandidates(routePath: string): string[] {
	const candidates = new Set<string>();
	const normalized = normalizeMimoCleanUrl(routePath);
	candidates.add(buildMimoSiteUrl(normalized));
	candidates.add(buildMimoSiteUrl(routePath));

	const blogAlias = normalized.match(/^\/blog\/(.+)$/);
	if (blogAlias?.[1]) {
		candidates.add(buildMimoSiteUrl(`/${blogAlias[1]}`));
	}

	return [...candidates];
}

export function buildMimoNewsUrl(slug: string): string {
	return buildMimoSiteUrl(`/${slug}`);
}

export function scoreMimoHeadResponse(response: Response): number {
	if (!response.ok) return 0;

	const disposition = response.headers.get('content-disposition') ?? '';
	const length = Number(response.headers.get('content-length') ?? '0');

	if (disposition.includes('filename="404.html"')) return 0;
	if (disposition.includes('filename="index.html"') && length > 15_000) return 3;
	if (disposition.includes('.html"') && length > 15_000) return 2;
	if (length > 15_000) return 1;
	if (length > 0 && length < 10_000) return 0;
	return 0;
}

/** Prefer the URL whose HTML looks like a real article, not a SPA shell or directory listing. */
export function scoreMimoPageHtml(html: string): number {
	const title = html.match(/<title[^>]*>([^<]*)<\/title>/)?.[1] ?? '';
	if (title === '404' || title.includes('Files within')) {
		return 0;
	}
	if (title.includes('MiMo') || title.includes('Xiaomi')) {
		return 3;
	}
	if (html.includes('name="description" content="') && html.length > 20_000) {
		return 2;
	}
	if (html.length > 15_000) {
		return 1;
	}
	return 0;
}

export async function resolveMimoNewsUrl(routePath: string, fetchFn: typeof fetch): Promise<string> {
	const candidates = buildMimoUrlCandidates(routePath);
	let bestUrl = buildMimoSiteUrl(normalizeMimoCleanUrl(routePath));
	let bestScore = -1;

	for (const url of candidates) {
		const response = await fetchFn(url, {
			method: 'HEAD',
			headers: { 'user-agent': 'beacon/1.0 (+https://github.com/d0zingcat/beacon)' },
		});

		let score = scoreMimoHeadResponse(response);
		if (score === 0 && response.ok) {
			const bodyResponse = await fetchFn(url, {
				headers: { 'user-agent': 'beacon/1.0 (+https://github.com/d0zingcat/beacon)' },
			});
			if (bodyResponse.ok) {
				score = scoreMimoPageHtml(await bodyResponse.text());
			}
		}

		if (score > bestScore) {
			bestScore = score;
			bestUrl = url;
		}
	}

	return bestUrl;
}

export function parseMimoPublishedAt(date?: string): string | undefined {
	if (!date) return undefined;
	const parsed = new Date(date);
	return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

export function buildMimoNewsItem(slug: string, frontmatter: MimoFrontmatter | null): RawItem {
	const title = frontmatter?.title?.trim() || slugToMimoTitle(slug);
	return {
		externalId: slug,
		url: buildMimoNewsUrl(slug),
		title,
		summary: frontmatter?.summary,
		publishedAt: parseMimoPublishedAt(frontmatter?.date),
	};
}

export function parseMimoNewsRoutes(
	routes: MimoBlogRoute[],
	chunkMap: Record<string, string>,
	loadChunk: (chunkId: string) => string | null | undefined,
): RawItem[] {
	const items: RawItem[] = [];
	const seen = new Set<string>();

	for (const route of routes) {
		if (seen.has(route.slug)) continue;

		let frontmatter: MimoFrontmatter | null = null;
		for (const chunkId of [...route.chunkIds].reverse()) {
			const hash = chunkMap[chunkId];
			if (!hash) continue;
			const chunkJs = loadChunk(chunkId);
			if (!chunkJs) continue;
			frontmatter = parseMimoFrontmatter(chunkJs);
			if (frontmatter) break;
		}

		seen.add(route.slug);
		items.push(buildMimoNewsItem(route.slug, frontmatter));
	}

	return items;
}

export async function fetchMimoNewsList(fetchFn: typeof fetch): Promise<RawItem[]> {
	const homeResponse = await fetchFn(MIMO_SITE_URL, {
		headers: {
			'user-agent': 'beacon/1.0 (+https://github.com/d0zingcat/beacon)',
			accept: 'text/html',
		},
	});
	if (!homeResponse.ok) {
		throw new Error(`MiMo homepage fetch failed: ${homeResponse.status} ${homeResponse.statusText}`);
	}

	const homeHtml = await homeResponse.text();
	const { indexPath, routesPath } = discoverMimoBundlePaths(homeHtml);

	const indexResponse = await fetchFn(resolveMimoAssetUrl(indexPath), {
		headers: { 'user-agent': 'beacon/1.0 (+https://github.com/d0zingcat/beacon)' },
	});
	if (!indexResponse.ok) {
		throw new Error(`MiMo index bundle fetch failed: ${indexResponse.status} ${indexResponse.statusText}`);
	}
	const chunkMap = parseAsyncChunkMap(await indexResponse.text());

	const routesResponse = await fetchFn(resolveMimoAssetUrl(routesPath), {
		headers: { 'user-agent': 'beacon/1.0 (+https://github.com/d0zingcat/beacon)' },
	});
	if (!routesResponse.ok) {
		throw new Error(`MiMo routes bundle fetch failed: ${routesResponse.status} ${routesResponse.statusText}`);
	}
	const routes = parseMimoBlogRoutes(await routesResponse.text());

	const chunkCache = new Map<string, string>();
	const loadChunk = (chunkId: string): string | null => {
		if (chunkCache.has(chunkId)) {
			return chunkCache.get(chunkId) ?? null;
		}
		return null;
	};

	for (const route of routes) {
		for (const chunkId of route.chunkIds) {
			if (chunkCache.has(chunkId)) continue;
			const hash = chunkMap[chunkId];
			if (!hash) continue;
			const chunkUrl = resolveMimoAssetUrl(`static/js/async/${chunkId}.${hash}.js`);
			const response = await fetchFn(chunkUrl, {
				headers: { 'user-agent': 'beacon/1.0 (+https://github.com/d0zingcat/beacon)' },
			});
			if (response.ok) {
				chunkCache.set(chunkId, await response.text());
			}
		}
	}

	const items = parseMimoNewsRoutes(routes, chunkMap, (chunkId) => chunkCache.get(chunkId));
	const routePathBySlug = new Map(routes.map((route) => [route.slug, route.routePath]));

	await Promise.all(
		items.map(async (item) => {
			const routePath = routePathBySlug.get(item.externalId) ?? `/blog/${item.externalId}`;
			item.url = await resolveMimoNewsUrl(routePath, fetchFn);
		}),
	);

	return items;
}

createSource(
	{
		id: 'mimo-news',
		name: 'Xiaomi MiMo News',
		mode: 'append',
	},
	{
		kind: 'webpage',
		extract(ctx) {
			return fetchMimoNewsList(ctx.fetch);
		},
	},
);
