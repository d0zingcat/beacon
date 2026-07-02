import { reserveNotifySlot } from '../db/notify-rate-limit';
import type { NotifierTransport } from './transport';
import { createSerialRateLimiter, sleep } from './rate-limiter';

/** Feishu custom bot: 100/min and 5/sec per tenant per bot. */
const FEISHU_MIN_INTERVAL_MS = 600;
const FEISHU_MAX_RETRIES = 3;
const FEISHU_RETRY_BASE_MS = 1_000;

const feishuSendLimiter = createSerialRateLimiter();

function isConfigured(env: Env): boolean {
	return Boolean(env.FEISHU_WEBHOOK_URL);
}

export function buildFeishuTextPayload(text: string): string {
	return JSON.stringify({
		msg_type: 'text',
		content: { text },
	});
}

export function isFeishuRateLimitError(code: number | undefined, msg?: string): boolean {
	return code === 11232 || (msg?.includes('frequency limited') ?? false);
}

function isRateLimitFailure(error: unknown): boolean {
	if (!(error instanceof Error)) {
		return false;
	}
	return error.message.includes('11232') || error.message.includes('frequency limited');
}

async function sendOnce(env: Env, text: string): Promise<void> {
	const response = await fetch(env.FEISHU_WEBHOOK_URL, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: buildFeishuTextPayload(text),
	});
	if (!response.ok) {
		const body = await response.text();
		throw new Error(`Feishu send failed: ${response.status} ${body}`);
	}
	const result = (await response.json()) as { code?: number; msg?: string };
	if (result.code !== undefined && result.code !== 0) {
		throw new Error(`Feishu send failed: ${result.code} ${result.msg ?? ''}`);
	}
}

async function sendWithRetry(env: Env, text: string): Promise<void> {
	for (let attempt = 0; attempt <= FEISHU_MAX_RETRIES; attempt++) {
		try {
			await sendOnce(env, text);
			return;
		} catch (error) {
			if (!isRateLimitFailure(error) || attempt === FEISHU_MAX_RETRIES) {
				throw error;
			}
			const delayMs = FEISHU_RETRY_BASE_MS * 2 ** attempt;
			await sleep(delayMs);
		}
	}
}

async function send(env: Env, text: string): Promise<void> {
	return feishuSendLimiter.schedule(async () => {
		await reserveNotifySlot(env.DB, 'feishu', FEISHU_MIN_INTERVAL_MS);
		await sendWithRetry(env, text);
	});
}

export const feishuTransport: NotifierTransport = {
	id: 'feishu',
	isConfigured,
	send,
};
