import { describe, expect, it } from 'vitest';
import {
	buildMimoNewsItem,
	decodeMimoJsString,
	discoverMimoBundlePaths,
	parseAsyncChunkMap,
	parseMimoBlogRoutes,
	parseMimoFrontmatter,
	parseMimoNewsRoutes,
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
			{ slug: 'mimo-code-long-horizon', chunkIds: ['6212', '3583', '1837'] },
			{ slug: 'mimo-v2-flash', chunkIds: ['9389'] },
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
			url: 'https://mimo.xiaomi.com/blog/mimo-code-long-horizon',
			title: 'MiMo Code',
			summary: 'Long-horizon agent',
			publishedAt: new Date('2026-06-10').toISOString(),
		});
	});

	it('falls back to slug-based title for custom pages', () => {
		expect(buildMimoNewsItem('mimo-v2-flash', null)).toEqual({
			externalId: 'mimo-v2-flash',
			url: 'https://mimo.xiaomi.com/blog/mimo-v2-flash',
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
				{ slug: 'mimo-code-long-horizon', chunkIds: ['6212', '1837'] },
				{ slug: 'mimo-v2-flash', chunkIds: ['9389'] },
			],
			{ '1837': 'abc', '9389': 'def' },
			(chunkId) => (chunkId === '1837' ? CHUNK_WITH_META : CHUNK_CUSTOM_ONLY),
		);

		expect(items).toHaveLength(2);
		expect(items[0]?.title).toBe('MiMo Code: Scaling Coding Agents to Long-Horizon Tasks');
		expect(items[1]?.title).toBe('MiMo V2 Flash');
	});
});
