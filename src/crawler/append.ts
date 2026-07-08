import type { RawItem } from '../sources/types';
import type { NotificationEvent } from '../notify/types';
import type { Db } from '../db/client';
import { getItemByExternalId, getItemByHash, insertItem, updateAppendItem } from '../db/repo';
import { hashAppendItem } from './dedupe';
import type { Source } from '../sources/types';

export interface AppendProcessResult {
	event: NotificationEvent | null;
	inserted: boolean;
	updated: boolean;
}

function normalizeItem(source: Source, raw: RawItem) {
	return source.normalize ? source.normalize(raw) : raw;
}

function toAppendEvent(source: Source, itemId: number, normalized: ReturnType<typeof normalizeItem>): NotificationEvent {
	return {
		kind: 'append',
		sourceId: source.id,
		sourceName: source.name,
		sourceKind: source.kind,
		itemId,
		title: normalized.title,
		url: normalized.url,
		summary: normalized.summary,
		publishedAt: normalized.publishedAt ? Date.parse(normalized.publishedAt) : undefined,
	};
}

export async function processAppendItem(
	db: Db,
	source: Source,
	raw: RawItem,
	now: number,
	options: { forceNotify?: boolean } = {},
): Promise<AppendProcessResult> {
	const normalized = normalizeItem(source, raw);
	const hash = await hashAppendItem({
		sourceId: source.id,
		externalId: normalized.externalId,
		title: normalized.title,
		url: normalized.url,
		summary: normalized.summary,
		content: normalized.content,
	});

	const byHash = await getItemByHash(db, source.id, hash);
	if (byHash) {
		if (options.forceNotify) {
			return {
				event: toAppendEvent(source, byHash.id, normalized),
				inserted: false,
				updated: false,
			};
		}
		return { event: null, inserted: false, updated: false };
	}

	const itemInput = {
		title: normalized.title,
		url: normalized.url,
		summary: normalized.summary,
		content: normalized.content,
		publishedAt: normalized.publishedAt ? Date.parse(normalized.publishedAt) : undefined,
		hash,
		rawJson: raw.raw ? JSON.stringify(raw.raw) : undefined,
		now,
	};

	const byExternalId = await getItemByExternalId(db, source.id, normalized.externalId);
	if (byExternalId) {
		await updateAppendItem(db, { itemId: byExternalId.id, ...itemInput });
		return {
			event: toAppendEvent(source, byExternalId.id, normalized),
			inserted: false,
			updated: true,
		};
	}

	const itemId = await insertItem(db, {
		sourceId: source.id,
		externalId: normalized.externalId,
		...itemInput,
	});

	return {
		event: toAppendEvent(source, itemId, normalized),
		inserted: true,
		updated: false,
	};
}
