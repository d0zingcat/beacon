import { launch } from '@cloudflare/playwright';
import type { Page, RawItem, Source, SourceContext } from './types';
import { registerSource } from './registry';

export interface BrowserSourceConfig {
	url: string;
}

export function createBrowserSource(
	base: Omit<Source, 'fetch' | 'kind'> & { mode: Source['mode'] },
	config: BrowserSourceConfig,
	fetchItems: (ctx: SourceContext, config: BrowserSourceConfig) => Promise<RawItem[]>,
): Source {
	const source: Source = {
		...base,
		kind: 'browser',
		async fetch(ctx) {
			if (!ctx.browser) {
				throw new Error('Browser binding is not available');
			}
			return fetchItems(ctx, config);
		},
	};
	registerSource(source);
	return source;
}

export async function withBrowserPage<T>(
	ctx: SourceContext,
	fn: (page: Page) => Promise<T>,
): Promise<T> {
	if (!ctx.browser) {
		throw new Error('Browser binding is not available');
	}
	const browser = await launch(ctx.browser);
	try {
		const page = await browser.newPage();
		return await fn(page);
	} finally {
		await browser.close();
	}
}
