import { describe, expect, it } from 'vitest';
import { buildFeishuNotificationPayload } from '../src/notify/feishu';
import { formatNotification } from '../src/notify/format';
import { parseQixiDmitStockPage, QIXI_DMIT_STOCK_URL } from '../src/sources/examples/dmit-stock';
// Bundled as a string at build time. The workers vitest pool shims `node:fs`
// and `process.env` in a way that can't reach the real `.dev.vars` on disk, so
// a `?raw` import (resolved by vite against the real filesystem) is the only
// way to read local secrets inside this test.
import devVarsRaw from '../.dev.vars?raw';

function readDevVar(key: string): string | undefined {
	for (const line of devVarsRaw.split('\n')) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) continue;
		const eq = trimmed.indexOf('=');
		if (eq === -1) continue;
		if (trimmed.slice(0, eq).trim() === key) {
			return trimmed.slice(eq + 1).trim();
		}
	}
	return undefined;
}

describe('force notify dmit sample', () => {
	it('sends one formatted in-stock notification', async () => {
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

		const item = items.find((entry) => entry.state?.available === true) ?? items[0];

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

		const webhook = readDevVar('FEISHU_WEBHOOK_URL');
		if (!webhook) {
			console.warn('跳过发送：未配置 FEISHU_WEBHOOK_URL（请创建 .dev.vars）');
			return;
		}

		// POST directly rather than going through feishuTransport, which needs a
		// D1 binding for rate-limit bookkeeping that isn't available here.
		const sendResponse = await fetch(webhook, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: buildFeishuNotificationPayload(event),
		});
		const body = await sendResponse.text();
		console.log(`\n--- feishu response: ${sendResponse.status} ---\n${body}\n`);
		expect(sendResponse.ok).toBe(true);
	});
});
