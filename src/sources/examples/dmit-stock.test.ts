import { describe, expect, it } from 'vitest';
import { parseDmitStorePage } from './dmit-stock';

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
