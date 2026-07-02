import { readFileSync, existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { formatNotification } from '../src/notify/format';
import { feishuTransport } from '../src/notify/feishu';
import {
	parseQixiDmitStockPage,
	QIXI_DMIT_STOCK_URL,
} from '../src/sources/examples/dmit-stock';

function loadDevVars(): void {
	if (!existsSync('.dev.vars')) return;
	for (const line of readFileSync('.dev.vars', 'utf8').split('\n')) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) continue;
		const eq = trimmed.indexOf('=');
		if (eq === -1) continue;
		const key = trimmed.slice(0, eq).trim();
		const value = trimmed.slice(eq + 1).trim();
		if (!process.env[key]) process.env[key] = value;
	}
}

describe('force notify dmit sample', () => {
	it('sends one formatted in-stock notification', async () => {
		loadDevVars();

		const response = await fetch(QIXI_DMIT_STOCK_URL, {
			headers: {
				'user-agent': 'beacon/1.0 (+https://github.com/d0zingcat/beacon)',
				accept: 'text/html,application/xhtml+xml',
			},
		});
		expect(response.ok).toBe(true);

		const html = await response.text();
		const items = parseQixiDmitStockPage(html);
		expect(items.length).toBeGreaterThan(0);

		const item =
			items.find((entry) => entry.state?.available === true) ?? items[0];

		const event = {
			kind: 'state_change' as const,
			sourceId: 'dmit-stock',
			sourceName: 'DMIT VPS Stock',
			itemId: 0,
			title: item.title,
			url: item.url,
			summary: item.summary,
			diff: {
				available: {
					from: false,
					to: item.state?.available === true,
				},
			},
		};

		const text = formatNotification(event);

		console.log('\n--- notification preview ---\n' + text + '\n------------------------------\n');

		const env = {
			FEISHU_WEBHOOK_URL: process.env.FEISHU_WEBHOOK_URL ?? '',
			TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN ?? '',
			TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID ?? '',
		} as Env;

		if (!feishuTransport.isConfigured(env)) {
			console.warn('跳过发送：未配置 FEISHU_WEBHOOK_URL（请创建 .dev.vars）');
			return;
		}

		await feishuTransport.send(env, event);
		console.log('已发送到飞书');
	});
});
