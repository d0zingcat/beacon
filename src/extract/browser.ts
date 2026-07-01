import { launch } from '@cloudflare/playwright';
import type { Page, SourceContext } from '../sources/types';
import type { RawItem } from '../sources/types';
import type { Extractor } from './types';

export interface BrowserExtractorConfig {
	extract: (ctx: SourceContext, page: Page) => Promise<RawItem[]>;
}

export function createBrowserExtractor(config: BrowserExtractorConfig): Extractor {
	return {
		kind: 'browser',
		async extract(ctx) {
			return withBrowserPage(ctx, (page) => config.extract(ctx, page));
		},
	};
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
