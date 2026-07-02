import type { Source } from '../sources/types';
import type { Db } from '../db/client';
import {
	getItemByExternalId,
	insertItem,
	insertState,
	updateItemState,
} from '../db/repo';
import { hashStateEntity, hashStateValue } from './dedupe';
import type { NotificationEvent } from '../notify/types';

export interface StateProcessResult {
	itemId: number;
	changed: boolean;
	diff?: Record<string, unknown>;
}

export function computeStateDiff(
	prev: Record<string, unknown>,
	next: Record<string, unknown>,
): Record<string, unknown> {
	const diff: Record<string, unknown> = {};
	const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
	for (const key of keys) {
		if (JSON.stringify(prev[key]) !== JSON.stringify(next[key])) {
			diff[key] = { from: prev[key], to: next[key] };
		}
	}
	return diff;
}

export async function defaultStateChanged(
	prev: Record<string, unknown> | null,
	next: Record<string, unknown>,
): Promise<boolean> {
	if (!prev) return true;
	const [prevHash, nextHash] = await Promise.all([
		hashStateValue(prev),
		hashStateValue(next),
	]);
	return prevHash !== nextHash;
}

export async function processStateItem(
	db: Db,
	source: Source,
	input: {
		externalId: string;
		title: string;
		url?: string;
		summary?: string;
		state: Record<string, unknown>;
		now: number;
	},
): Promise<StateProcessResult> {
	const existing = await getItemByExternalId(db, source.id, input.externalId);
	const hash = await hashStateEntity({
		sourceId: source.id,
		externalId: input.externalId,
	});

	let itemId: number;
	let prevState: Record<string, unknown> | null = null;

	if (existing) {
		itemId = existing.id;
		prevState = existing.state_json ? JSON.parse(existing.state_json) : null;
	} else {
		itemId = await insertItem(db, {
			sourceId: source.id,
			externalId: input.externalId,
			title: input.title,
			url: input.url,
			summary: input.summary,
			hash,
			stateJson: JSON.stringify(input.state),
			now: input.now,
		});
	}

	const changed = source.diff
		? prevState
			? source.diff(prevState, input.state)
			: false
		: await defaultStateChanged(prevState, input.state);

	const diff = prevState ? computeStateDiff(prevState, input.state) : undefined;

	await insertState(db, {
		itemId,
		sourceId: source.id,
		observedAt: input.now,
		stateJson: JSON.stringify(input.state),
		changed,
		diffJson: diff && Object.keys(diff).length > 0 ? JSON.stringify(diff) : undefined,
	});

	if (changed) {
		await updateItemState(db, {
			itemId,
			stateJson: JSON.stringify(input.state),
			prevStateJson: prevState ? JSON.stringify(prevState) : null,
			now: input.now,
		});
	}

	return { itemId, changed, diff };
}

export function toStateChangeEvent(
	source: Source,
	input: {
		itemId: number;
		title: string;
		url?: string;
		summary?: string;
		diff?: Record<string, unknown>;
	},
): NotificationEvent {
	return {
		kind: 'state_change',
		sourceId: source.id,
		sourceName: source.name,
		itemId: input.itemId,
		title: input.title,
		url: input.url,
		summary: input.summary,
		diff: input.diff,
	};
}
