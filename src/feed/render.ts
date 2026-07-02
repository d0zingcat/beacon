import type { ItemRow } from '../db/repo';

export interface FeedChannel {
	title: string;
	link: string;
	description?: string;
}

export interface FeedItem {
	title: string;
	link?: string;
	guid: string;
	description?: string;
	pubDate: Date;
}

export function escapeXml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

export function mapItemRowToFeedItem(item: ItemRow): FeedItem {
	return {
		title: item.title,
		link: item.url ?? undefined,
		guid: item.url ?? `${item.source_id}:${item.external_id}`,
		description: item.summary ?? item.content ?? undefined,
		pubDate: new Date(item.published_at ?? item.created_at),
	};
}

export function renderRssFeed(channel: FeedChannel, items: FeedItem[]): string {
	const channelParts = [
		`<title>${escapeXml(channel.title)}</title>`,
		`<link>${escapeXml(channel.link)}</link>`,
		channel.description
			? `<description>${escapeXml(channel.description)}</description>`
			: '',
	].filter(Boolean);

	const itemXml = items
		.map((item) => {
			const parts = [
				`<title>${escapeXml(item.title)}</title>`,
				item.link ? `<link>${escapeXml(item.link)}</link>` : '',
				`<guid isPermaLink="${item.link ? 'true' : 'false'}">${escapeXml(item.guid)}</guid>`,
				item.description ? `<description>${escapeXml(item.description)}</description>` : '',
				`<pubDate>${item.pubDate.toUTCString()}</pubDate>`,
			].filter(Boolean);
			return `<item>${parts.join('')}</item>`;
		})
		.join('');

	return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel>${channelParts.join('')}${itemXml}</channel></rss>`;
}
