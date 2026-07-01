/** Minimal JSONC parse for wrangler config (no trailing commas). */
export function parseJsonc(text) {
	const withoutComments = text.replace(/^\s*\/\/.*$/gm, '');
	return JSON.parse(withoutComments);
}
