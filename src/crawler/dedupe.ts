export async function sha1Hex(value: string): Promise<string> {
	const data = new TextEncoder().encode(value);
	const digest = await crypto.subtle.digest('SHA-1', data);
	return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function hashAppendItem(input: {
	sourceId: string;
	externalId: string;
	title: string;
	url?: string;
	summary?: string;
	content?: string;
}): Promise<string> {
	return sha1Hex(
		JSON.stringify({
			sourceId: input.sourceId,
			externalId: input.externalId,
			title: input.title,
			url: input.url ?? '',
			summary: input.summary ?? '',
			content: input.content ?? '',
		}),
	);
}

export async function hashStateEntity(input: {
	sourceId: string;
	externalId: string;
}): Promise<string> {
	return sha1Hex(JSON.stringify(input));
}

export async function hashStateValue(state: Record<string, unknown>): Promise<string> {
	return sha1Hex(JSON.stringify(state));
}
