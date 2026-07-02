import { describe, expect, it } from 'vitest';
import {
	parseDmitStorePage,
	parseQixiDmitStockPage,
	resolveDmitAffId,
	rewriteDmitAffUrl,
} from './dmit-stock';

const SAMPLE_QIXI_ROW_IN = `
<tr class="in-stock-row" data-id="48" onclick="handleTableRowClick(this)">
  <td class="px-4 py-3" data-label="状态"><span class="text-green-400">🟢 有货</span></td>
  <td class="px-4 py-3 text-white font-medium" data-label="商品">HKG.AS3.T1.TINY</td>
  <td class="px-4 py-3 text-gray-300" data-label="位置">Hong Kong</td>
  <td class="px-4 py-3 text-gray-300" data-label="配置">1核 / 1G / 20G</td>
  <td class="px-4 py-3 text-white" data-label="价格"><span class="text-green-400 font-bold">$39.9/月</span></td>
  <td class="px-4 py-3" data-label="操作">
    <a href="https://www.dmit.io/aff.php?aff=1098&amp;pid=201" target="_blank" class="btn btn-sm btn-primary">购买</a>
  </td>
</tr>`;

const SAMPLE_QIXI_ROW_OUT = `
<tr class="out-stock-row" data-id="70" onclick="handleTableRowClick(this)">
  <td class="px-4 py-3" data-label="状态"><span class="text-red-400">🔴 缺货</span></td>
  <td class="px-4 py-3 text-white font-medium" data-label="商品">LAX.AN5.Pro.TINY</td>
  <td class="px-4 py-3 text-gray-300" data-label="位置">Los Angeles</td>
  <td class="px-4 py-3 text-gray-300" data-label="配置">1核 / 2G / 20G</td>
  <td class="px-4 py-3 text-white" data-label="价格"><span class="text-green-400 font-bold">$12.98/月</span></td>
  <td class="px-4 py-3" data-label="操作">
    <a href="https://www.dmit.io/aff.php?aff=1098&amp;pid=100" target="_blank" class="btn btn-sm btn-primary">购买</a>
  </td>
</tr>`;

const SAMPLE_IN_STOCK = `
LAX.AN5.T1.V2C2G

$

14.90

USD

/ Monthly

Free Setup
`;

const SAMPLE_OUT_OF_STOCK = `
LAX.AN5.T1.G2C4G

Out of Stock

$

16.90

USD

/ Monthly
`;

const SAMPLE_ANNUAL_IN_STOCK = `
Popular

HKG.AS3.T1.WEE

$

36.90

USD

/ Annually
`;

describe('rewriteDmitAffUrl', () => {
	it('replaces affiliate id on Dmit purchase links', () => {
		expect(
			rewriteDmitAffUrl('https://www.dmit.io/aff.php?aff=1098&pid=201', '23808'),
		).toBe('https://www.dmit.io/aff.php?aff=23808&pid=201');
	});

	it('uses env override when provided', () => {
		expect(resolveDmitAffId({ DMIT_AFF_ID: '99999' })).toBe('99999');
		expect(resolveDmitAffId({} as Env)).toBe('23808');
	});
});

describe('parseQixiDmitStockPage', () => {
	it('parses in-stock and out-of-stock table rows', () => {
		const items = parseQixiDmitStockPage(SAMPLE_QIXI_ROW_IN + SAMPLE_QIXI_ROW_OUT);

		expect(items).toEqual([
			{
				externalId: 'HKG.AS3.T1.TINY',
				title: 'HKG.AS3.T1.TINY',
				url: 'https://www.dmit.io/aff.php?aff=23808&pid=201',
				summary: '$39.9/月',
				state: {
					available: true,
					price: '$39.9/月',
					source: 'stock.qixi.me',
				},
			},
			{
				externalId: 'LAX.AN5.Pro.TINY',
				title: 'LAX.AN5.Pro.TINY',
				url: 'https://www.dmit.io/aff.php?aff=23808&pid=100',
				summary: '缺货',
				state: {
					available: false,
					price: '$12.98/月',
					source: 'stock.qixi.me',
				},
			},
		]);
	});
});

describe('parseDmitStorePage', () => {
	it('parses in-stock product with monthly price', () => {
		const items = parseDmitStorePage(SAMPLE_IN_STOCK);

		expect(items).toEqual([
			{
				externalId: 'LAX.AN5.T1.V2C2G',
				title: 'LAX.AN5.T1.V2C2G',
				url: 'https://www.dmit.io/cart.php',
				summary: 'USD 14.90 / Monthly',
				state: {
					available: true,
					price: 'USD 14.90',
					billingCycle: 'Monthly',
				},
			},
		]);
	});

	it('parses out-of-stock product', () => {
		const items = parseDmitStorePage(SAMPLE_OUT_OF_STOCK);

		expect(items).toEqual([
			{
				externalId: 'LAX.AN5.T1.G2C4G',
				title: 'LAX.AN5.T1.G2C4G',
				url: 'https://www.dmit.io/cart.php',
				summary: 'Out of Stock',
				state: {
					available: false,
					price: undefined,
					billingCycle: undefined,
				},
			},
		]);
	});

	it('parses annual billing cycle and ignores Popular label', () => {
		const items = parseDmitStorePage(SAMPLE_ANNUAL_IN_STOCK);

		expect(items).toEqual([
			{
				externalId: 'HKG.AS3.T1.WEE',
				title: 'HKG.AS3.T1.WEE',
				url: 'https://www.dmit.io/cart.php',
				summary: 'USD 36.90 / Annually',
				state: {
					available: true,
					price: 'USD 36.90',
					billingCycle: 'Annually',
				},
			},
		]);
	});

	it('parses mixed stock from a realistic page excerpt', () => {
		const text = SAMPLE_IN_STOCK + SAMPLE_OUT_OF_STOCK + SAMPLE_ANNUAL_IN_STOCK;
		const items = parseDmitStorePage(text);

		expect(items).toHaveLength(3);
		expect(items.map((item) => item.externalId)).toEqual([
			'LAX.AN5.T1.V2C2G',
			'LAX.AN5.T1.G2C4G',
			'HKG.AS3.T1.WEE',
		]);
		expect(items.filter((item) => item.state?.available)).toHaveLength(2);
	});
});
