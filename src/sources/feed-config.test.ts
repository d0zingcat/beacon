import { describe, expect, it } from 'vitest';
import {
	parseFeedSourceConfig,
	serializeFeedSourceConfig,
	validateFeedSourceInput,
} from './feed-config';

describe('feed-config', () => {
	it('parses valid feed config', () => {
		expect(
			parseFeedSourceConfig(
				JSON.stringify({
					feedUrl: 'https://openai.com/news/rss.xml',
					headers: { accept: 'application/rss+xml' },
				}),
			),
		).toEqual({
			feedUrl: 'https://openai.com/news/rss.xml',
			headers: { accept: 'application/rss+xml' },
		});
	});

	it('rejects non-https feed urls', () => {
		expect(parseFeedSourceConfig(JSON.stringify({ feedUrl: 'http://example.com/feed.xml' }))).toBeNull();
	});

	it('validates feed source input', () => {
		expect(
			validateFeedSourceInput({
				id: 'openai-blog',
				name: 'OpenAI Blog',
				mode: 'append',
				schedule: '0 * * * *',
				config: { feedUrl: 'https://openai.com/news/rss.xml' },
			}),
		).toEqual({
			id: 'openai-blog',
			name: 'OpenAI Blog',
			mode: 'append',
			schedule: '0 * * * *',
			config: { feedUrl: 'https://openai.com/news/rss.xml' },
		});
	});

	it('round-trips feed config json', () => {
		const config = { feedUrl: 'https://kiro.dev/changelog/feed.rss' };
		expect(parseFeedSourceConfig(serializeFeedSourceConfig(config))).toEqual(config);
	});
});
