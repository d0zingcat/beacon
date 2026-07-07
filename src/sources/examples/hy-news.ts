import { createSource } from '../factory';
import type { RawItem } from '../types';

export const HY_NEWS_LIST_URL = 'https://api.hunyuan.tencent.com/api/blog/publicList';
export const HY_NEWS_SITE_URL = 'https://hy.tencent.com';
const PAGE_SIZE = 50;

export interface HunyuanBlogEntry {
	id: number;
	customUrl?: string;
	title: string;
	desc?: string;
	author?: string;
	displayPublishTime?: number;
	publishedAt?: number;
	createdAt?: number;
}

export interface HunyuanNewsListData {
	list?: HunyuanBlogEntry[];
	totalNum?: number;
}

export function buildHunyuanNewsSlug(entry: Pick<HunyuanBlogEntry, 'id' | 'customUrl'>): string {
	const customUrl = entry.customUrl?.trim();
	return customUrl || String(entry.id);
}

export function buildHunyuanNewsUrl(entry: Pick<HunyuanBlogEntry, 'id' | 'customUrl'>): string {
	return `${HY_NEWS_SITE_URL}/research/${buildHunyuanNewsSlug(entry)}`;
}

export function parseHunyuanNewsTimestamp(entry: HunyuanBlogEntry): string | undefined {
	const seconds = entry.displayPublishTime ?? entry.publishedAt ?? entry.createdAt;
	if (!seconds) return undefined;
	return new Date(seconds * 1000).toISOString();
}

export function parseHunyuanNewsList(data: HunyuanNewsListData): RawItem[] {
	const items: RawItem[] = [];
	const seen = new Set<string>();

	for (const entry of data.list ?? []) {
		if (!entry.title?.trim()) continue;

		const externalId = buildHunyuanNewsSlug(entry);
		if (seen.has(externalId)) continue;
		seen.add(externalId);

		items.push({
			externalId,
			url: buildHunyuanNewsUrl(entry),
			title: entry.title.trim(),
			summary: entry.desc?.trim() || entry.author?.trim() || undefined,
			publishedAt: parseHunyuanNewsTimestamp(entry),
		});
	}

	return items;
}

export async function fetchHunyuanNewsList(fetchFn: typeof fetch): Promise<RawItem[]> {
	const items: RawItem[] = [];
	let pageNum = 1;
	let totalNum = Number.POSITIVE_INFINITY;

	while (items.length < totalNum) {
		const response = await fetchFn(HY_NEWS_LIST_URL, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				accept: 'application/json',
				'user-agent': 'beacon/1.0 (+https://github.com/d0zingcat/beacon)',
			},
			body: JSON.stringify({ pageNum, pageSize: PAGE_SIZE }),
		});

		if (!response.ok) {
			throw new Error(`Hunyuan news fetch failed: ${response.status} ${response.statusText}`);
		}

		const payload = (await response.json()) as {
			code?: number;
			msg?: string;
			data?: HunyuanNewsListData;
		};

		if (payload.code !== 0) {
			throw new Error(`Hunyuan news API error: ${payload.msg ?? 'unknown error'}`);
		}

		const data = payload.data ?? {};
		totalNum = data.totalNum ?? items.length;
		const pageItems = parseHunyuanNewsList(data);
		if (pageItems.length === 0) break;

		items.push(...pageItems);
		if (pageItems.length < PAGE_SIZE) break;
		pageNum += 1;
	}

	return items;
}

createSource(
	{
		id: 'hy-news',
		name: 'Tencent Hy News',
		mode: 'append',
	},
	{
		kind: 'webpage',
		extract(ctx) {
			return fetchHunyuanNewsList(ctx.fetch);
		},
	},
);
