import { createRssSource, parseRssFeed } from '../rss';

const FEED_URL = 'https://kiro.dev/changelog/feed.rss';

createRssSource(
	{
		id: 'kiro-changelog',
		name: 'Kiro Changelog',
		schedule: '0 * * * *',
	},
	{
		feedUrl: FEED_URL,
	},
	async (ctx, config) => {
		const response = await ctx.fetch(config.feedUrl, {
			headers: {
				'user-agent': 'beacon/1.0 (+https://github.com/d0zingcat/beacon)',
				accept: 'application/rss+xml, application/xml, text/xml',
			},
		});
		if (!response.ok) {
			throw new Error(`RSS fetch failed: ${response.status} ${response.statusText}`);
		}
		return parseRssFeed(await response.text());
	},
);
