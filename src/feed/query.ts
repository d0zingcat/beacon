import type { Source } from '../sources/types';
import type { FeedChannel } from './render';

export function parseSourceIds(value: string | undefined): string[] | undefined {
	if (!value?.trim()) {
		return undefined;
	}

	const ids = [...new Set(value.split(',').map((part) => part.trim()).filter(Boolean))];
	return ids.length > 0 ? ids : undefined;
}

export type FeedSourceValidation =
	| { ok: true; sourceIds: string[] | undefined }
	| { ok: false; status: 400 | 404; error: string; sourceId: string };

export function validateFeedSources(
	sourceIds: string[] | undefined,
	getSource: (id: string) => Source | undefined,
): FeedSourceValidation {
	if (!sourceIds) {
		return { ok: true, sourceIds: undefined };
	}

	for (const sourceId of sourceIds) {
		const source = getSource(sourceId);
		if (!source) {
			return { ok: false, status: 404, error: 'Source not found', sourceId };
		}
		if (source.mode !== 'append') {
			return {
				ok: false,
				status: 400,
				error: 'Only append sources are supported in feed',
				sourceId,
			};
		}
	}

	return { ok: true, sourceIds };
}

export function buildFeedChannel(
	sourceIds: string[] | undefined,
	feedUrl: string,
	getSource: (id: string) => Source | undefined,
): FeedChannel {
	if (!sourceIds) {
		return {
			title: 'Beacon',
			link: feedUrl,
			description: 'Aggregated append feed from beacon',
		};
	}

	const names = sourceIds.map((id) => getSource(id)!.name);
	if (names.length === 1) {
		return {
			title: names[0]!,
			link: feedUrl,
			description: `${names[0]} feed from beacon`,
		};
	}

	return {
		title: names.join(' + '),
		link: feedUrl,
		description: `Combined feed: ${names.join(', ')}`,
	};
}

export function buildFeedUrl(reqUrl: string, sourceIds: string[] | undefined): string {
	const feedUrl = new URL('/feed', reqUrl);
	if (sourceIds) {
		feedUrl.searchParams.set('source', sourceIds.join(','));
	}
	return feedUrl.toString();
}
