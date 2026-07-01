import { createWebpageExtractor } from '../../extract/webpage';
import { createSource } from '../factory';
import type { RawItem } from '../types';

/** Third-party DMIT stock aggregator (Dmit 官网对自动化浏览器有 bot 验证). */
export const QIXI_DMIT_STOCK_URL = 'https://stock.qixi.me/';
export const OUT_OF_STOCK_TEXT = 'Out of Stock';
const PRODUCT_NAME_RE = /^(?:LAX|HKG|TYO)\.[A-Za-z0-9.]+$/;
const TABLE_ROW_RE = /<tr class="(in-stock-row|out-stock-row)"[\s\S]*?<\/tr>/g;

export function parseQixiDmitStockPage(html: string): RawItem[] {
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
		const url = urlMatch?.[1]?.replace(/&amp;/g, '&');

		items.push({
			externalId: title,
			title,
			url: url ?? QIXI_DMIT_STOCK_URL,
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
		schedule: '*/15 * * * *',
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
		parse(html) {
			const items = parseQixiDmitStockPage(html);
			if (items.length === 0) {
				throw new Error('No DMIT products parsed from stock.qixi.me');
			}
			return items;
		},
	}),
);
