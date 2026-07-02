import type { NotificationEvent } from '../notify/types';
import { getSource } from '../sources/registry';
import { createDb } from '../db/client';
import {
	finishRunLog,
	getSourceLastStatus,
	startRunLog,
	updateSourceRunStatus,
	upsertSource,
} from '../db/repo';
import { processAppendItem } from './append';
import { processStateItem, toStateChangeEvent } from './state';
import { dispatchNotifications } from '../notify/dispatch';

export interface RunOptions {
	/** Notify for every item fetched in this run, not only new/changed ones. */
	forceNotify?: boolean;
}

export interface RunResult {
	sourceId: string;
	itemsNew: number;
	itemsTotal: number;
	itemsNotified: number;
	stateChanges: number;
	forceNotify: boolean;
	status: 'ok' | 'error';
	error?: string;
}

export async function runSource(
	env: Env,
	sourceId: string,
	options: RunOptions = {},
): Promise<RunResult> {
	const forceNotify = options.forceNotify === true;
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
			itemsNotified: 0,
			stateChanges: 0,
			forceNotify,
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
				const { event, inserted } = await processAppendItem(db, source, raw, now, {
					forceNotify,
				});
				if (inserted) {
					itemsNew += 1;
				}
				if (event) {
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
				}
				if (result.changed || forceNotify) {
					const isDmitStock = source.id === 'dmit-stock';
					const diff =
						result.diff && Object.keys(result.diff).length > 0
							? result.diff
							: forceNotify && isDmitStock
								? { snapshot: raw.state }
								: undefined;
					notifyEvents.push(
						toStateChangeEvent(source, {
							itemId: result.itemId,
							title: raw.title,
							url: raw.url,
							summary: isDmitStock ? raw.summary : undefined,
							publishedAt: raw.publishedAt ? Date.parse(raw.publishedAt) : undefined,
							diff,
						}),
					);
				}
			}
		}

		const itemsNotified = notifyEvents.length;

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
			itemsNotified,
			stateChanges,
			forceNotify,
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
			itemsNotified: 0,
			stateChanges,
			forceNotify,
			status: 'error',
			error: message,
		};
	}
}
