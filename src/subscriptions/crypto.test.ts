import { describe, expect, it } from 'vitest';
import { decryptSecret, encryptSecret, fingerprintSecret, maskWebhookUrl } from './crypto';

const KEY = '0123456789abcdef0123456789abcdef';
const WEBHOOK = 'https://open.feishu.cn/open-apis/bot/v2/hook/abcdef1234567890';

describe('subscription crypto', () => {
	it('encrypts and decrypts webhook secrets', async () => {
		const ciphertext = await encryptSecret(WEBHOOK, KEY);

		expect(ciphertext).not.toContain(WEBHOOK);
		expect(ciphertext).toMatch(/^[A-Za-z0-9_-]+$/);
		expect(await decryptSecret(ciphertext, KEY)).toBe(WEBHOOK);
	});

	it('uses a random nonce for each encryption', async () => {
		const first = await encryptSecret(WEBHOOK, KEY);
		const second = await encryptSecret(WEBHOOK, KEY);

		expect(first).not.toBe(second);
		expect(await decryptSecret(first, KEY)).toBe(WEBHOOK);
		expect(await decryptSecret(second, KEY)).toBe(WEBHOOK);
	});

	it('fingerprints secrets deterministically', async () => {
		const fingerprint = await fingerprintSecret(WEBHOOK);

		expect(fingerprint).toBe(await fingerprintSecret(WEBHOOK));
		expect(fingerprint).toMatch(/^[a-f0-9]{64}$/);
		expect(fingerprint).not.toContain(WEBHOOK);
	});

	it('masks webhook urls for display', () => {
		expect(maskWebhookUrl(WEBHOOK)).toBe(
			'https://open.feishu.cn/open-apis/bot/v2/hook/abcd...7890',
		);
	});
});
