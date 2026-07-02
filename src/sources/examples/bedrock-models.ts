import { createWebpageExtractor } from '../../extract/webpage';
import { createSource } from '../factory';
import type { RawItem } from '../types';

const MODEL_CARDS_URL =
	'https://docs.aws.amazon.com/bedrock/latest/userguide/model-cards.md';
const BASE_URL = 'https://docs.aws.amazon.com/bedrock/latest/userguide/';

// Negative lookahead avoids matching provider index pages (model-cards-*.md).
function extractModelLinks(cell: string): RegExpMatchArray[] {
	const re = /\[([^\]]+)\]\((?:\.\/)?(model-card-(?!s)[^)]+\.(?:md|html))\)/g;
	return [...cell.matchAll(re)];
}

export function parseBedrockModelsMarkdown(md: string): RawItem[] {
	const items: RawItem[] = [];

	for (const line of md.split('\n')) {
		if (!line.startsWith('|') || line.includes('---') || !line.includes('model-card-')) {
			continue;
		}

		const parts = line.split('|').map((c) => c.trim());
		// Table columns: | Logo | Provider | Supported models |
		if (parts.length < 4) continue;

		const providerCol = parts[2];
		const modelsCol = parts[3];
		if (!modelsCol) continue;

		const providerMatch = providerCol.match(/\[([^\]]+)\]/);
		const provider = providerMatch?.[1] ?? 'Unknown';

		for (const match of extractModelLinks(modelsCol)) {
			const title = match[1].trim();
			const path = match[2].replace(/\.md$/, '.html').replace(/^\.\//, '');
			const slug = path.replace(/^model-card-/, '').replace(/\.html$/, '');

			items.push({
				externalId: slug,
				title,
				summary: provider,
				url: `${BASE_URL}${path}`,
			});
		}
	}

	return items;
}

createSource(
	{
		id: 'bedrock-models',
		name: 'AWS Bedrock Models',
		mode: 'append',
	},
	createWebpageExtractor({
		url: MODEL_CARDS_URL,
		headers: {
			'user-agent': 'beacon/1.0 (+https://github.com/d0zingcat/beacon)',
			accept: 'text/markdown, text/plain, */*',
		},
		parse: (md, _ctx) => parseBedrockModelsMarkdown(md),
	}),
);
