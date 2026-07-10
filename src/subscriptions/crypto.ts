function toBase64Url(bytes: Uint8Array): string {
	let binary = '';
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value: string): Uint8Array {
	const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
	const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
	const binary = atob(padded);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

function toHex(bytes: ArrayBuffer): string {
	return [...new Uint8Array(bytes)]
		.map((byte) => byte.toString(16).padStart(2, '0'))
		.join('');
}

async function importAesKey(key: string): Promise<CryptoKey> {
	const raw = new TextEncoder().encode(key);
	if (raw.byteLength !== 32) {
		throw new Error('WEBHOOK_ENCRYPTION_KEY must be 32 bytes');
	}
	return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function encryptSecret(plaintext: string, key: string): Promise<string> {
	const nonce = new Uint8Array(12);
	crypto.getRandomValues(nonce);
	const cryptoKey = await importAesKey(key);
	const ciphertext = new Uint8Array(
		await crypto.subtle.encrypt(
			{ name: 'AES-GCM', iv: nonce },
			cryptoKey,
			new TextEncoder().encode(plaintext),
		),
	);
	const payload = new Uint8Array(nonce.byteLength + ciphertext.byteLength);
	payload.set(nonce, 0);
	payload.set(ciphertext, nonce.byteLength);
	return toBase64Url(payload);
}

export async function decryptSecret(ciphertext: string, key: string): Promise<string> {
	const payload = fromBase64Url(ciphertext);
	const nonce = payload.slice(0, 12);
	const body = payload.slice(12);
	const cryptoKey = await importAesKey(key);
	const plaintext = await crypto.subtle.decrypt(
		{ name: 'AES-GCM', iv: nonce },
		cryptoKey,
		body,
	);
	return new TextDecoder().decode(plaintext);
}

export async function fingerprintSecret(value: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
	return toHex(digest);
}

export function maskWebhookUrl(url: string): string {
	const marker = '/hook/';
	const index = url.indexOf(marker);
	if (index === -1) {
		return 'masked webhook';
	}
	const prefix = url.slice(0, index + marker.length);
	const token = url.slice(index + marker.length);
	if (token.length <= 8) {
		return `${prefix}...`;
	}
	return `${prefix}${token.slice(0, 4)}...${token.slice(-4)}`;
}
