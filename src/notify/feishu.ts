import type { NotifierTransport } from './transport';

function isConfigured(env: Env): boolean {
	return Boolean(env.FEISHU_WEBHOOK_URL);
}

export function buildFeishuTextPayload(text: string): string {
	return JSON.stringify({
		msg_type: 'text',
		content: { text },
	});
}

async function send(env: Env, text: string): Promise<void> {
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

export const feishuTransport: NotifierTransport = {
	id: 'feishu',
	isConfigured,
	send,
};
