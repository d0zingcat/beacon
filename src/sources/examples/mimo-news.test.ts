import { describe, expect, it } from 'vitest';
import {
	buildMimoNewsItem,
	buildMimoUrlCandidates,
	decodeMimoJsString,
	discoverMimoBundlePaths,
	normalizeMimoCleanUrl,
	parseAsyncChunkMap,
	parseMimoBlogRoutes,
	parseMimoFrontmatter,
	parseMimoNewsRoutes,
	resolveMimoNewsUrl,
	scoreMimoHeadResponse,
	scoreMimoPageHtml,
	slugToMimoTitle,
} from './mimo-news';

const ROUTE_SNIPPET = `
{path:"/blog/mimo-code-long-horizon",element:o.createElement(f),filePath:"en/blog/mimo-code-long-horizon.mdx",preload:async()=>(await f.preload(),Promise.all([t.e("6212"),t.e("3583"),t.e("1837")]).then(t.bind(t,50520))),lang:"en",version:""}
{path:"/blog/mimo-v2-flash",element:o.createElement(E),filePath:"en/blog/mimo-v2-flash.mdx",preload:async()=>(await E.preload(),t.e("9389").then(t.bind(t,41208))),lang:"en",version:""}
{path:"/zh/blog/mimo-v2-flash",element:o.createElement(eE),filePath:"zh/blog/mimo-v2-flash.mdx",preload:async()=>(await eE.preload(),t.e("9389").then(t.bind(t,87935))),lang:"zh",version:""}
`;

const INDEX_SNIPPET = `
t.u=e=>"static/js/async/"+e+"."+({1837:"3da03cd4",9389:"61ede854",6212:"abc12345"})[e]+".js"
`;

const CHUNK_WITH_META = `
frontmatter:{pageType:"custom",title:"MiMo Code: Scaling Coding Agents to Long-Horizon Tasks",description:"MiMo Code is a terminal-based coding agent.",date:"2026-06-10"}
`;

const CHUNK_CUSTOM_ONLY = `
frontmatter:{pageType:"custom"}
`;

describe('parseMimoBlogRoutes', () => {
	it('parses English blog routes and skips zh routes', () => {
		const routes = parseMimoBlogRoutes(ROUTE_SNIPPET);
		expect(routes).toEqual([
			{ routePath: '/blog/mimo-code-long-horizon', slug: 'mimo-code-long-horizon', chunkIds: ['6212', '3583', '1837'] },
			{ routePath: '/blog/mimo-v2-flash', slug: 'mimo-v2-flash', chunkIds: ['9389'] },
		]);
	});
});

describe('parseAsyncChunkMap', () => {
	it('extracts async chunk hashes from index bundle', () => {
		expect(parseAsyncChunkMap(INDEX_SNIPPET)).toEqual({
			'1837': '3da03cd4',
			'9389': '61ede854',
			'6212': 'abc12345',
		});
	});
});

describe('discoverMimoBundlePaths', () => {
	it('finds index and routes bundles from homepage html', () => {
		const html = `
<script defer src="https://cdn.example.com/static/js/styles.abc.js"></script>
<script defer src="https://cdn.example.com/static/js/index.ea5be4ea.js"></script>
<script defer src="https://cdn.example.com/static/js/4752.8a78ca6d.js"></script>
`;
		expect(discoverMimoBundlePaths(html)).toEqual({
			indexPath: 'static/js/index.ea5be4ea.js',
			routesPath: 'static/js/4752.8a78ca6d.js',
		});
	});
});

describe('parseMimoFrontmatter', () => {
	it('parses title, summary, and date', () => {
		expect(parseMimoFrontmatter(CHUNK_WITH_META)).toEqual({
			title: 'MiMo Code: Scaling Coding Agents to Long-Horizon Tasks',
			summary: 'MiMo Code is a terminal-based coding agent.',
			date: '2026-06-10',
		});
	});

	it('returns null when title is missing', () => {
		expect(parseMimoFrontmatter(CHUNK_CUSTOM_ONLY)).toBeNull();
	});
});

describe('decodeMimoJsString', () => {
	it('decodes hex escape sequences', () => {
		expect(decodeMimoJsString('MiMo \\xd7 TileRT')).toBe('MiMo × TileRT');
	});
});

describe('buildMimoUrlCandidates', () => {
	it('derives clean and blog aliases from routePath', () => {
		expect(buildMimoUrlCandidates('/blog/mimo-v2-5-asr')).toEqual([
			'https://mimo.xiaomi.com/blog/mimo-v2-5-asr',
			'https://mimo.xiaomi.com/mimo-v2-5-asr',
		]);
	});

	it('keeps non-blog route paths as-is', () => {
		expect(buildMimoUrlCandidates('/news/mimo-v2-6')).toEqual([
			'https://mimo.xiaomi.com/news/mimo-v2-6',
		]);
	});
});

describe('normalizeMimoCleanUrl', () => {
	it('strips .html when cleanUrls is enabled', () => {
		expect(normalizeMimoCleanUrl('/blog/example.html')).toBe('/blog/example');
	});
});

describe('scoreMimoHeadResponse', () => {
	it('prefers pre-rendered index pages over spa shells', () => {
		const article = new Response(null, {
			status: 200,
			headers: {
				'content-length': '41101',
				'content-disposition': 'inline; filename="index.html"',
			},
		});
		const shell = new Response(null, {
			status: 200,
			headers: {
				'content-length': '6279',
				'content-disposition': 'inline; filename="mimo-v2-5-asr.html"',
			},
		});

		expect(scoreMimoHeadResponse(article)).toBeGreaterThan(scoreMimoHeadResponse(shell));
	});
});

describe('scoreMimoPageHtml', () => {
	it('prefers pre-rendered article pages over directory listings', () => {
		const article = `<title>MiMo-V2.5-ASR | Xiaomi</title>${'x'.repeat(30_000)}`;
		const listing = '<title>Files within doc_build&#47;mimo-code-long-horizon&#47;</title>';
		const spaShell = `<title data-rh="true"></title>${'x'.repeat(6_000)}`;
		const blogArticle = `<title data-rh="true"></title><meta name="description" content="summary"/>${'x'.repeat(30_000)}`;

		expect(scoreMimoPageHtml(article)).toBeGreaterThan(scoreMimoPageHtml(listing));
		expect(scoreMimoPageHtml(article)).toBeGreaterThan(scoreMimoPageHtml(spaShell));
		expect(scoreMimoPageHtml(blogArticle)).toBeGreaterThan(scoreMimoPageHtml(spaShell));
	});
});

describe('resolveMimoNewsUrl', () => {
	it('picks the candidate with the higher page score', async () => {
		const url = await resolveMimoNewsUrl('/blog/mimo-v2-5-asr', async (input, init) => {
			const href = String(input);
			const headers =
				href.endsWith('/blog/mimo-v2-5-asr')
					? {
							'content-length': '6279',
							'content-disposition': 'inline; filename="mimo-v2-5-asr.html"',
						}
					: {
							'content-length': '41101',
							'content-disposition': 'inline; filename="index.html"',
						};
			return new Response(null, { status: 200, headers });
		});

		expect(url).toBe('https://mimo.xiaomi.com/mimo-v2-5-asr');
	});

	it('falls back to /blog/ when the plain slug is missing', async () => {
		const url = await resolveMimoNewsUrl('/blog/mimo-v2-5-inference', async (input, init) => {
			const href = String(input);
			if (href.endsWith('/mimo-v2-5-inference') && init?.method === 'HEAD') {
				return new Response(null, { status: 404, headers: { 'content-disposition': 'inline; filename="404.html"' } });
			}
			if (href.endsWith('/blog/mimo-v2-5-inference')) {
				return new Response(null, {
					status: 200,
					headers: {
						'content-length': '52331',
						'content-disposition': 'inline; filename="mimo-v2-5-inference.html"',
					},
				});
			}
			return new Response('<title>404</title>', { status: 404 });
		});

		expect(url).toBe('https://mimo.xiaomi.com/blog/mimo-v2-5-inference');
	});
});

describe('buildMimoNewsItem', () => {
	it('uses frontmatter when available', () => {
		expect(
			buildMimoNewsItem('mimo-code-long-horizon', {
				title: 'MiMo Code',
				date: '2026-06-10',
				summary: 'Long-horizon agent',
			}),
		).toEqual({
			externalId: 'mimo-code-long-horizon',
			url: 'https://mimo.xiaomi.com/mimo-code-long-horizon',
			title: 'MiMo Code',
			summary: 'Long-horizon agent',
			publishedAt: new Date('2026-06-10').toISOString(),
		});
	});

	it('falls back to slug-based title for custom pages', () => {
		expect(buildMimoNewsItem('mimo-v2-flash', null)).toEqual({
			externalId: 'mimo-v2-flash',
			url: 'https://mimo.xiaomi.com/mimo-v2-flash',
			title: 'MiMo V2 Flash',
			summary: undefined,
			publishedAt: undefined,
		});
		expect(slugToMimoTitle('mimo-v2-5')).toBe('MiMo V2.5');
	});
});

describe('parseMimoNewsRoutes', () => {
	it('maps routes to items using async chunks', () => {
		const items = parseMimoNewsRoutes(
			[
				{ routePath: '/blog/mimo-code-long-horizon', slug: 'mimo-code-long-horizon', chunkIds: ['6212', '1837'] },
				{ routePath: '/blog/mimo-v2-flash', slug: 'mimo-v2-flash', chunkIds: ['9389'] },
			],
			{ '1837': 'abc', '9389': 'def' },
			(chunkId) => (chunkId === '1837' ? CHUNK_WITH_META : CHUNK_CUSTOM_ONLY),
		);

		expect(items).toHaveLength(2);
		expect(items[0]?.title).toBe('MiMo Code: Scaling Coding Agents to Long-Horizon Tasks');
		expect(items[1]?.title).toBe('MiMo V2 Flash');
	});
});
