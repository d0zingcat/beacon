import { createBrowserSource } from '../browser';

createBrowserSource(
	{
		id: 'vps-stock',
		name: 'VPS Stock Monitor',
		mode: 'state',
		schedule: '*/15 * * * *',
		diff(prev, next) {
			return prev.available !== next.available || prev.price !== next.price;
		},
	},
	{
		url: 'https://example.com/vps',
	},
	async () => {
		// TODO: 用 Browser Rendering 抓取 VPS 库存/价格
		return [];
	},
);
