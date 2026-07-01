import { createBrowserExtractor } from '../../extract/browser';
import { createSource } from '../factory';
import type { RawItem } from '../types';

export const DMIT_STORE_URL = 'https://www.dmit.io/cart.php';
const OUT_OF_STOCK_TEXT = 'Out of Stock';
const PRODUCT_NAME_RE = /^(?:LAX|HKG|TYO)\.[A-Za-z0-9.]+$/;

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
			url: DMIT_STORE_URL,
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
	createBrowserExtractor({
		async extract(_ctx, page) {
			await page.goto(DMIT_STORE_URL, {
				waitUntil: 'domcontentloaded',
				timeout: 90_000,
			});
			await page.getByText('LAX.AN5').first().waitFor({ timeout: 60_000 });

			const text = await page.locator('body').innerText();
			const items = parseDmitStorePage(text);
			if (items.length === 0) {
				throw new Error('DMIT store page parsed zero products');
			}
			return items;
		},
	}),
);
