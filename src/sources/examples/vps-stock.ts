import { createSource } from '../factory';

createSource(
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
		kind: 'browser',
		async extract(ctx) {
			if (!ctx.browser) {
				throw new Error('Browser binding is not available');
			}
			// TODO: 用 Browser Rendering 抓取 VPS 库存/价格
			return [];
		},
	},
);
