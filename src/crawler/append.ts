import type { RawItem } from '../sources/types';
import type { NotificationEvent } from '../notify/types';
import type { Db } from '../db/client';
import { getItemByExternalId, getItemByHash, insertItem, updateAppendItem } from '../db/repo';
import { hashAppendItem } from './dedupe';
import { DEFAULT_APPEND_NOTIFY_MAX_AGE_DAYS } from '../config';
import type { Source } from '../sources/types';

export interface AppendProcessResult {
	event: NotificationEvent | null;
	inserted: boolean;
	updated: boolean;
}

export interface AppendProcessOptions {
	forceNotify?: boolean;
	/** Skip notifications for items published more than this many days before `now`. */
	notifyMaxAgeDays?: number;
}

const DAY_MS = 86_400_000;

/**
 * True when the item has a parseable publish timestamp older than the window.
 * Items without `publishedAt` (or with unparseable/future dates) are not
 * considered stale so sources that omit dates keep notifying.
 */
export function isStalePublication(
	publishedAt: string | undefined,
	now: number,
	maxAgeDays: number,
): boolean {
	if (!publishedAt) return false;
	const ts = Date.parse(publishedAt);
	if (Number.isNaN(ts)) return false;
	return now - ts > maxAgeDays * DAY_MS;
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
	options: AppendProcessOptions = {},
): Promise<AppendProcessResult> {
	const normalized = normalizeItem(source, raw);
	// Upstream changelog re-keys (slug/text edits) can resurface year-old
	// entries as brand-new inserts; store them but suppress the alert.
	const stale =
		!options.forceNotify &&
		isStalePublication(
			normalized.publishedAt,
			now,
			options.notifyMaxAgeDays ?? DEFAULT_APPEND_NOTIFY_MAX_AGE_DAYS,
		);
	const eventFor = (itemId: number): NotificationEvent | null =>
		stale ? null : toAppendEvent(source, itemId, normalized);
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
			event: eventFor(byExternalId.id),
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
		event: eventFor(itemId),
		inserted: true,
		updated: false,
	};
}
