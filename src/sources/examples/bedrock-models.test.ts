import { describe, expect, it } from 'vitest';
import { parseBedrockModelsMarkdown } from './bedrock-models';

const SAMPLE_MARKDOWN = `
| Logo | Provider | Supported models |
| --- | --- | --- |
|  | [OpenAI](model-cards-openai.md) | [GPT-5.5](model-card-openai-gpt-55.md), [GPT-5.4](model-card-openai-gpt-54.md) |
|  | [Anthropic](model-cards-anthropic.md) | **Claude 5.x:** [Claude Sonnet 5](model-card-anthropic-claude-sonnet-5.md), [Claude Mythos 5](model-card-anthropic-claude-mythos-5.md) |
|  | [xAI](model-cards-xai.md) | [Grok 4.3](model-card-xai-grok-4-3.md) |
`;

describe('parseBedrockModelsMarkdown', () => {
	it('parses model cards from the supported models table', () => {
		const items = parseBedrockModelsMarkdown(SAMPLE_MARKDOWN);

		expect(items).toEqual([
			{
				externalId: 'openai-gpt-55',
				title: 'GPT-5.5',
				summary: 'OpenAI',
				url: 'https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-openai-gpt-55.html',
			},
			{
				externalId: 'openai-gpt-54',
				title: 'GPT-5.4',
				summary: 'OpenAI',
				url: 'https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-openai-gpt-54.html',
			},
			{
				externalId: 'anthropic-claude-sonnet-5',
				title: 'Claude Sonnet 5',
				summary: 'Anthropic',
				url: 'https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-anthropic-claude-sonnet-5.html',
			},
			{
				externalId: 'anthropic-claude-mythos-5',
				title: 'Claude Mythos 5',
				summary: 'Anthropic',
				url: 'https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-anthropic-claude-mythos-5.html',
			},
			{
				externalId: 'xai-grok-4-3',
				title: 'Grok 4.3',
				summary: 'xAI',
				url: 'https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-xai-grok-4-3.html',
			},
		]);
	});

	it('ignores provider index links (model-cards-*)', () => {
		const items = parseBedrockModelsMarkdown(SAMPLE_MARKDOWN);

		expect(items.every((item) => !item.externalId.startsWith('s-'))).toBe(true);
		expect(items).toHaveLength(5);
	});
});
