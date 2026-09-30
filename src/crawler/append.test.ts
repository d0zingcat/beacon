import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isStalePublication, processAppendItem } from './append';
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

		const result = await processAppendItem(
			db,
			source,
			{
				...rawItem,
				publishedAt: '2026-07-01T01:30:00.000Z',
			},
			now,
		);

		expect(result.event).toMatchObject({
			kind: 'append',
			itemId: 42,
			title: rawItem.title,
			publishedAt: Date.parse('2026-07-01T01:30:00.000Z'),
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

	it('stores stale inserts quietly (no notify for old publishedAt)', async () => {
		vi.mocked(getItemByHash).mockResolvedValue(null);
		vi.mocked(getItemByExternalId).mockResolvedValue(null);
		vi.mocked(insertItem).mockResolvedValue(99);

		// Published ~13 months before `now` (e.g. a re-keyed 2025 changelog entry).
		const publishedAt = new Date(now - 400 * 86_400_000).toISOString();
		const result = await processAppendItem(db, source, { ...rawItem, publishedAt }, now);

		expect(result.inserted).toBe(true);
		expect(result.event).toBeNull();
		expect(insertItem).toHaveBeenCalledOnce();
	});

	it('stores stale updates quietly too', async () => {
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

		const publishedAt = new Date(now - 30 * 86_400_000).toISOString();
		const result = await processAppendItem(db, source, { ...rawItem, publishedAt }, now);

		expect(result.updated).toBe(true);
		expect(result.event).toBeNull();
		expect(updateAppendItem).toHaveBeenCalledOnce();
	});

	it('notifies recent inserts within the max-age window', async () => {
		vi.mocked(getItemByHash).mockResolvedValue(null);
		vi.mocked(getItemByExternalId).mockResolvedValue(null);
		vi.mocked(insertItem).mockResolvedValue(100);

		const publishedAt = new Date(now - 2 * 86_400_000).toISOString();
		const result = await processAppendItem(db, source, { ...rawItem, publishedAt }, now);

		expect(result.event).toMatchObject({ itemId: 100, title: rawItem.title });
	});

	it('honors per-source notifyMaxAgeDays override', async () => {
		vi.mocked(getItemByHash).mockResolvedValue(null);
		vi.mocked(getItemByExternalId).mockResolvedValue(null);
		vi.mocked(insertItem).mockResolvedValue(101);

		const publishedAt = new Date(now - 10 * 86_400_000).toISOString();

		// Default 7-day window: stale, suppressed.
		const suppressed = await processAppendItem(db, source, { ...rawItem, publishedAt }, now);
		expect(suppressed.event).toBeNull();

		// Relaxed 30-day window: notified.
		vi.mocked(insertItem).mockResolvedValue(102);
		const notified = await processAppendItem(db, source, { ...rawItem, publishedAt }, now, {
			notifyMaxAgeDays: 30,
		});
		expect(notified.event).toMatchObject({ itemId: 102 });
	});

	it('forceNotify bypasses the staleness guard', async () => {
		vi.mocked(getItemByHash).mockResolvedValue(null);
		vi.mocked(getItemByExternalId).mockResolvedValue(null);
		vi.mocked(insertItem).mockResolvedValue(103);

		const publishedAt = new Date(now - 400 * 86_400_000).toISOString();
		const result = await processAppendItem(db, source, { ...rawItem, publishedAt }, now, {
			forceNotify: true,
		});

		expect(result.event).toMatchObject({ itemId: 103 });
	});
});

describe('isStalePublication', () => {
	it('treats dates older than the window as stale', () => {
		expect(isStalePublication(new Date(now - 8 * 86_400_000).toISOString(), now, 7)).toBe(true);
		expect(isStalePublication(new Date(now - 6 * 86_400_000).toISOString(), now, 7)).toBe(false);
	});

	it('never treats missing or unparseable dates as stale', () => {
		expect(isStalePublication(undefined, now, 7)).toBe(false);
		expect(isStalePublication('not-a-date', now, 7)).toBe(false);
	});

	it('never treats future dates as stale', () => {
		expect(isStalePublication(new Date(now + 5 * 86_400_000).toISOString(), now, 7)).toBe(false);
	});
});
