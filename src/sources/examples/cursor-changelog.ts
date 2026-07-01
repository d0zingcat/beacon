import { createRssSource } from '../rss';

createRssSource(
	{
		id: 'cursor-changelog',
		name: 'Cursor Changelog',
		schedule: '0 * * * *',
	},
	{
		feedUrl: 'https://www.cursor.com/changelog/rss',
	},
	async () => {
		// TODO: 接入真实 RSS 解析或自定义抓取
		return [];
	},
);
