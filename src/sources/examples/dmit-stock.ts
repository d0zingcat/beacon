import { createWebpageExtractor } from '../../extract/webpage';
import { createSource } from '../factory';
import type { RawItem } from '../types';

/** Third-party DMIT stock aggregator (Dmit 官网对自动化浏览器有 bot 验证). */
export const QIXI_DMIT_STOCK_URL = 'https://stock.qixi.me/';
export const OUT_OF_STOCK_TEXT = 'Out of Stock';
const PRODUCT_NAME_RE = /^(?:LAX|HKG|TYO)\.[A-Za-z0-9.]+$/;
const TABLE_ROW_RE = /<tr class="(in-stock-row|out-stock-row)"[\s\S]*?<\/tr>/g;

/** Default DMIT affiliate ID for purchase links rewritten from third-party aggregators. */
export const DEFAULT_DMIT_AFF_ID = '23808';

export function resolveDmitAffId(env?: Pick<Env, 'DMIT_AFF_ID'>): string {
	const configured = env?.DMIT_AFF_ID?.trim();
	return configured || DEFAULT_DMIT_AFF_ID;
}

/** Replace affiliate ID on Dmit purchase URLs while preserving pid and other params. */
export function rewriteDmitAffUrl(url: string, affId: string = DEFAULT_DMIT_AFF_ID): string {
	try {
		const parsed = new URL(url);
		if (!parsed.hostname.endsWith('dmit.io')) {
			return url;
		}
		if (parsed.pathname.includes('aff.php') || parsed.searchParams.has('pid')) {
			parsed.searchParams.set('aff', affId);
			return parsed.toString();
		}
	} catch {
		return url;
	}
	return url;
}

export function parseQixiDmitStockPage(
	html: string,
	affId: string = DEFAULT_DMIT_AFF_ID,
): RawItem[] {
	const items: RawItem[] = [];

	for (const rowMatch of html.matchAll(TABLE_ROW_RE)) {
		const row = rowMatch[0];
		const available = rowMatch[1] === 'in-stock-row';
		const nameMatch = row.match(/data-label="商品"[^>]*>([^<]+)</);
		if (!nameMatch) {
			continue;
		}

		const title = nameMatch[1].trim();
		if (!PRODUCT_NAME_RE.test(title)) {
			continue;
		}

		const priceMatch = row.match(
			/data-label="价格"[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>/,
		);
		const price = priceMatch?.[1]?.trim();
		const urlMatch = row.match(/href="(https:\/\/www\.dmit\.io\/[^"]+)"/);
		const url = rewriteDmitAffUrl(
			urlMatch?.[1]?.replace(/&amp;/g, '&') ?? QIXI_DMIT_STOCK_URL,
			affId,
		);

		items.push({
			externalId: title,
			title,
			url,
			summary: available ? (price ?? '有货') : '缺货',
			state: {
				available,
				price,
				source: 'stock.qixi.me',
			},
		});
	}

	return items;
}

/** Parse Dmit store listing text (used when scraping cart.php directly). */
export function parseDmitStorePage(text: string): RawItem[] {
	const lines = text
		.split('\n')
		.map((line) => line.trim())
		.filter(Boolean);

	const items: RawItem[] = [];

	for (let i = 0; i < lines.length; i++) {
		const name = lines[i];
		if (!PRODUCT_NAME_RE.test(name)) {
			continue;
		}

		const nextLine = lines[i + 1];
		const available = nextLine !== OUT_OF_STOCK_TEXT;

		let price: string | undefined;
		let billingCycle: string | undefined;

		if (available && nextLine === '$') {
			const amount = lines[i + 2];
			const currency = lines[i + 3];
			if (amount && currency) {
				price = `${currency} ${amount}`;
			}
			for (let j = i + 4; j < Math.min(i + 8, lines.length); j++) {
				if (lines[j].startsWith('/ ')) {
					billingCycle = lines[j].slice(2).trim();
					break;
				}
			}
		}

		const summary = available
			? [price, billingCycle].filter(Boolean).join(' / ')
			: OUT_OF_STOCK_TEXT;

		items.push({
			externalId: name,
			title: name,
			url: 'https://www.dmit.io/cart.php',
			summary,
			state: {
				available,
				price,
				billingCycle,
			},
		});
	}

	return items;
}

createSource(
	{
		id: 'dmit-stock',
		name: 'DMIT VPS Stock',
		mode: 'state',
		diff(prev, next) {
			return prev.available !== next.available;
		},
	},
	createWebpageExtractor({
		url: QIXI_DMIT_STOCK_URL,
		headers: {
			'user-agent': 'beacon/1.0 (+https://github.com/d0zingcat/beacon)',
			accept: 'text/html,application/xhtml+xml',
		},
		parse(html, ctx) {
			const affId = resolveDmitAffId(ctx.env);
			const items = parseQixiDmitStockPage(html, affId);
			if (items.length === 0) {
				throw new Error('No DMIT products parsed from stock.qixi.me');
			}
			return items;
		},
	}),
);
