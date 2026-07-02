import { beforeEach, describe, expect, it, vi } from 'vitest';
import { processAppendItem } from './append';
import type { Source } from '../sources/types';
import type { Db } from '../db/client';

vi.mock('../db/repo', () => ({
	getItemByHash: vi.fn(),
	getItemByExternalId: vi.fn(),
	insertItem: vi.fn(),
	updateAppendItem: vi.fn(),
}));

import {
	getItemByExternalId,
	getItemByHash,
	insertItem,
	updateAppendItem,
} from '../db/repo';

const source: Source = {
	id: 'kiro-changelog',
	name: 'Kiro Changelog',
	kind: 'feed',
	mode: 'append',
	schedule: '0 * * * *',
	fetch: vi.fn(),
};

const db = {} as Db;
const now = 1_700_000_000_000;

const rawItem = {
	externalId: 'https://kiro.dev/changelog/models/sonnet-5',
	title: 'Models: Claude Sonnet 5',
	url: 'https://kiro.dev/changelog/models/sonnet-5',
	summary: 'Initial summary',
};

describe('processAppendItem', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('skips unchanged items matched by hash', async () => {
		vi.mocked(getItemByHash).mockResolvedValue({
			id: 1,
			source_id: source.id,
			external_id: rawItem.externalId,
			title: rawItem.title,
			url: rawItem.url,
			summary: rawItem.summary,
			content: null,
			published_at: null,
			hash: 'existing-hash',
			raw_json: null,
			notified: 1,
			state_json: null,
			prev_state_json: null,
			state_changed_at: null,
			updated_at: now,
			created_at: now,
		});

		const result = await processAppendItem(db, source, rawItem, now);

		expect(result).toEqual({ event: null, inserted: false, updated: false });
		expect(getItemByExternalId).not.toHaveBeenCalled();
		expect(insertItem).not.toHaveBeenCalled();
		expect(updateAppendItem).not.toHaveBeenCalled();
	});

	it('updates and notifies when external_id exists but content changed', async () => {
		vi.mocked(getItemByHash).mockResolvedValue(null);
		vi.mocked(getItemByExternalId).mockResolvedValue({
			id: 7,
			source_id: source.id,
			external_id: rawItem.externalId,
			title: 'Old title',
			url: rawItem.url,
			summary: 'Old summary',
			content: null,
			published_at: null,
			hash: 'old-hash',
			raw_json: null,
			notified: 1,
			state_json: null,
			prev_state_json: null,
			state_changed_at: null,
			updated_at: now,
			created_at: now,
		});
		vi.mocked(updateAppendItem).mockResolvedValue(undefined);

		const result = await processAppendItem(db, source, rawItem, now);

		expect(result.inserted).toBe(false);
		expect(result.updated).toBe(true);
		expect(result.event).toMatchObject({
			kind: 'append',
			itemId: 7,
			title: rawItem.title,
		});
		expect(updateAppendItem).toHaveBeenCalledOnce();
		expect(insertItem).not.toHaveBeenCalled();
	});

	it('inserts new items when neither hash nor external_id match', async () => {
		vi.mocked(getItemByHash).mockResolvedValue(null);
		vi.mocked(getItemByExternalId).mockResolvedValue(null);
		vi.mocked(insertItem).mockResolvedValue(42);

		const result = await processAppendItem(db, source, rawItem, now);

		expect(result).toMatchObject({
			inserted: true,
			updated: false,
			event: {
				kind: 'append',
				itemId: 42,
				title: rawItem.title,
			},
		});
		expect(insertItem).toHaveBeenCalledOnce();
		expect(updateAppendItem).not.toHaveBeenCalled();
	});

	it('still notifies unchanged items when forceNotify is set', async () => {
		vi.mocked(getItemByHash).mockResolvedValue({
			id: 3,
			source_id: source.id,
			external_id: rawItem.externalId,
			title: rawItem.title,
			url: rawItem.url,
			summary: rawItem.summary,
			content: null,
			published_at: null,
			hash: 'existing-hash',
			raw_json: null,
			notified: 1,
			state_json: null,
			prev_state_json: null,
			state_changed_at: null,
			updated_at: now,
			created_at: now,
		});

		const result = await processAppendItem(db, source, rawItem, now, { forceNotify: true });

		expect(result).toMatchObject({
			inserted: false,
			updated: false,
			event: {
				kind: 'append',
				itemId: 3,
			},
		});
	});
});
