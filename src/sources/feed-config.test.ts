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
			batchNotifyMaxItems: 10,
		});
	});

	it('parses batchNotifyMaxItems from feed config', () => {
		expect(
			parseFeedSourceConfig(
				JSON.stringify({
					feedUrl: 'https://openai.com/news/rss.xml',
					batchNotifyMaxItems: 5,
				}),
			),
		).toEqual({
			feedUrl: 'https://openai.com/news/rss.xml',
			batchNotifyMaxItems: 5,
		});
	});

	it('rejects invalid batchNotifyMaxItems', () => {
		expect(
			parseFeedSourceConfig(
				JSON.stringify({
					feedUrl: 'https://openai.com/news/rss.xml',
					batchNotifyMaxItems: 0,
				}),
			),
		).toBeNull();
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
				config: { feedUrl: 'https://openai.com/news/rss.xml' },
			}),
		).toEqual({
			id: 'openai-blog',
			name: 'OpenAI Blog',
			mode: 'append',
			config: { feedUrl: 'https://openai.com/news/rss.xml', batchNotifyMaxItems: 10 },
		});
	});

	it('round-trips feed config json', () => {
		const config = { feedUrl: 'https://kiro.dev/changelog/feed.rss', batchNotifyMaxItems: 10 };
		expect(parseFeedSourceConfig(serializeFeedSourceConfig(config))).toEqual(config);
	});
});
