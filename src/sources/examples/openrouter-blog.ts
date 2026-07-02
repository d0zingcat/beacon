import { createFeedExtractor } from '../../extract/feed';
import { createSource } from '../factory';

const FEED_URL = 'https://openrouter.ai/blog/feed.xml';

createSource(
	{
		id: 'openrouter-blog',
		name: 'OpenRouter Blog',
		mode: 'append',
		schedule: '0 * * * *',
	},
	createFeedExtractor({
		feedUrl: FEED_URL,
		headers: {
			'user-agent': 'beacon/1.0 (+https://github.com/d0zingcat/beacon)',
			accept: 'application/rss+xml, application/xml, text/xml',
		},
	}),
);
