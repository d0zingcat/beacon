import type { NotifyEvent, RawItem } from '../sources/types';
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
import { dispatchNotifyEvents, notifyCrawlError } from '../notify/telegram';

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
): Promise<NotifyEvent | null> {
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
		type: 'append',
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
		await notifyCrawlError(env, {
			sourceId,
			sourceName: sourceId,
			error: `Source not found: ${sourceId}`,
		});
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
	const notifyEvents: NotifyEvent[] = [];

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

		await dispatchNotifyEvents(env, db, notifyEvents);
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
		await notifyCrawlError(
			env,
			{
				sourceId: source.id,
				sourceName: source.name,
				error: message,
			},
			{ previousStatus },
		);
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
