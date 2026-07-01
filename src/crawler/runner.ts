import type { RawItem } from '../sources/types';
import type { NotificationEvent } from '../notify/types';
import { getSource } from '../sources/registry';
import { createDb } from '../db/client';
import {
	finishRunLog,
	getSourceLastStatus,
	hasItemByHash,
	insertItem,
	startRunLog,
	updateSourceRunStatus,
	upsertSource,
} from '../db/repo';
import { hashAppendItem } from './dedupe';
import { processStateItem, toStateChangeEvent } from './state';
import { dispatchNotifications } from '../notify/dispatch';

export interface RunResult {
	sourceId: string;
	itemsNew: number;
	itemsTotal: number;
	stateChanges: number;
	status: 'ok' | 'error';
	error?: string;
}

function normalizeItem(source: NonNullable<ReturnType<typeof getSource>>, raw: RawItem) {
	return source.normalize ? source.normalize(raw) : raw;
}

async function processAppendItem(
	db: ReturnType<typeof createDb>,
	source: NonNullable<ReturnType<typeof getSource>>,
	raw: RawItem,
	now: number,
): Promise<NotificationEvent | null> {
	const normalized = normalizeItem(source, raw);
	const hash = await hashAppendItem({
		sourceId: source.id,
		externalId: normalized.externalId,
		title: normalized.title,
		url: normalized.url,
		summary: normalized.summary,
		content: normalized.content,
	});

	if (await hasItemByHash(db, source.id, hash)) {
		return null;
	}

	const itemId = await insertItem(db, {
		sourceId: source.id,
		externalId: normalized.externalId,
		title: normalized.title,
		url: normalized.url,
		summary: normalized.summary,
		content: normalized.content,
		publishedAt: normalized.publishedAt ? Date.parse(normalized.publishedAt) : undefined,
		hash,
		rawJson: raw.raw ? JSON.stringify(raw.raw) : undefined,
		now,
	});

	return {
		kind: 'append',
		sourceId: source.id,
		sourceName: source.name,
		itemId,
		title: normalized.title,
		url: normalized.url,
		summary: normalized.summary,
	};
}

export async function runSource(env: Env, sourceId: string): Promise<RunResult> {
	const source = getSource(sourceId);
	if (!source) {
		await dispatchNotifications(env, createDb(env), [
			{
				kind: 'crawl_error',
				sourceId,
				sourceName: sourceId,
				error: `Source not found: ${sourceId}`,
			},
		]);
		return {
			sourceId,
			itemsNew: 0,
			itemsTotal: 0,
			stateChanges: 0,
			status: 'error',
			error: `Source not found: ${sourceId}`,
		};
	}

	const db = createDb(env);
	const now = Date.now();
	const runId = await startRunLog(db, sourceId, now);
	const previousStatus = await getSourceLastStatus(db, sourceId);

	await upsertSource(db, {
		id: source.id,
		name: source.name,
		kind: source.kind,
		mode: source.mode,
		now,
	});

	let itemsNew = 0;
	let stateChanges = 0;
	let itemsTotal = 0;
	const notifyEvents: NotificationEvent[] = [];

	try {
		const rawItems = await source.fetch({
			env,
			fetch: globalThis.fetch.bind(globalThis),
			browser: env.BROWSER,
		});
		itemsTotal = rawItems.length;

		if (source.mode === 'append') {
			for (const raw of rawItems) {
				const event = await processAppendItem(db, source, raw, now);
				if (event) {
					itemsNew += 1;
					notifyEvents.push(event);
				}
			}
		} else {
			for (const raw of rawItems) {
				if (!raw.state) {
					continue;
				}
				const result = await processStateItem(db, source, {
					externalId: raw.externalId,
					title: raw.title,
					url: raw.url,
					summary: raw.summary,
					state: raw.state,
					now,
				});
				if (result.changed) {
					stateChanges += 1;
					notifyEvents.push(
						toStateChangeEvent(source, {
							itemId: result.itemId,
							title: raw.title,
							url: raw.url,
							diff: result.diff,
						}),
					);
				}
			}
		}

		await dispatchNotifications(env, db, notifyEvents);
		await finishRunLog(db, {
			runId,
			status: 'ok',
			itemsNew,
			itemsTotal,
			stateChanges,
			finishedAt: Date.now(),
		});
		await updateSourceRunStatus(db, sourceId, 'ok', Date.now());

		return {
			sourceId,
			itemsNew,
			itemsTotal,
			stateChanges,
			status: 'ok',
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		await finishRunLog(db, {
			runId,
			status: 'error',
			error: message,
			itemsNew,
			itemsTotal,
			stateChanges,
			finishedAt: Date.now(),
		});
		await updateSourceRunStatus(db, sourceId, 'error', Date.now());
		await dispatchNotifications(env, db, [
			{
				kind: 'crawl_error',
				sourceId: source.id,
				sourceName: source.name,
				error: message,
				suppress: previousStatus === 'error',
			},
		]);
		return {
			sourceId,
			itemsNew,
			itemsTotal,
			stateChanges,
			status: 'error',
			error: message,
		};
	}
}
