import type { Db } from '../db/client';

export type FeishuChannelStatus = 'active' | 'paused' | 'error';
export type DeliveryStatus = 'sent' | 'failed' | 'skipped';

export interface FeishuChannelRow extends Record<string, unknown> {
	id: number;
	user_id: number;
	display_name: string;
	webhook_ciphertext: string;
	webhook_fingerprint: string;
	webhook_mask: string;
	status: FeishuChannelStatus;
	consecutive_failures: number;
	last_test_at: number | null;
	last_error: string | null;
	created_at: number;
	updated_at: number;
}

export interface SubscriptionRow extends Record<string, unknown> {
	id: number;
	user_id: number;
	channel_id: number;
	source_id: string;
	enabled: number;
	created_at: number;
	updated_at: number;
}

export interface DeliveryRow extends Record<string, unknown> {
	id: number;
	channel_id: number;
	source_id: string;
	event_kind: string;
	item_id: number | null;
	event_key: string;
	status: DeliveryStatus;
	error: string | null;
	sent_at: number | null;
	created_at: number;
}

export interface SubscribedChannelRow extends FeishuChannelRow {
	source_id: string;
}

export async function upsertFeishuChannel(
	db: Db,
	input: {
		userId: number;
		displayName: string;
		webhookCiphertext: string;
		webhookFingerprint: string;
		webhookMask: string;
		now: number;
	},
): Promise<number> {
	const existing = await db.first<{ id: number }>(
		`SELECT id FROM feishu_channels WHERE user_id = ? AND webhook_fingerprint = ? LIMIT 1`,
		input.userId,
		input.webhookFingerprint,
	);
	if (existing) {
		await db.run(
			`UPDATE feishu_channels SET
       display_name = ?,
       webhook_ciphertext = ?,
       webhook_mask = ?,
       status = 'active',
       consecutive_failures = 0,
       last_test_at = ?,
       last_error = NULL,
       updated_at = ?
       WHERE id = ?`,
			input.displayName,
			input.webhookCiphertext,
			input.webhookMask,
			input.now,
			input.now,
			existing.id,
		);
		return existing.id;
	}
	const result = await db.run(
		`INSERT INTO feishu_channels (
       user_id, display_name, webhook_ciphertext, webhook_fingerprint,
       webhook_mask, status, consecutive_failures, last_test_at, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, 'active', 0, ?, ?, ?)`,
		input.userId,
		input.displayName,
		input.webhookCiphertext,
		input.webhookFingerprint,
		input.webhookMask,
		input.now,
		input.now,
		input.now,
	);
	return Number(result.meta.last_row_id);
}

export async function listFeishuChannelsByUser(
	db: Db,
	userId: number,
): Promise<FeishuChannelRow[]> {
	return db.all<FeishuChannelRow>(
		`SELECT * FROM feishu_channels WHERE user_id = ? ORDER BY id ASC`,
		userId,
	);
}

export async function getFeishuChannelForUser(
	db: Db,
	input: { userId: number; channelId: number },
): Promise<FeishuChannelRow | null> {
	return db.first<FeishuChannelRow>(
		`SELECT * FROM feishu_channels WHERE user_id = ? AND id = ? LIMIT 1`,
		input.userId,
		input.channelId,
	);
}

export async function deleteFeishuChannelForUser(
	db: Db,
	input: { userId: number; channelId: number },
): Promise<boolean> {
	await db.run(`DELETE FROM subscriptions WHERE user_id = ? AND channel_id = ?`, input.userId, input.channelId);
	const result = await db.run(
		`DELETE FROM feishu_channels WHERE user_id = ? AND id = ?`,
		input.userId,
		input.channelId,
	);
	return (result.meta.changes ?? 0) > 0;
}

export async function replaceSubscriptions(
	db: Db,
	input: { userId: number; channelId: number; sourceIds: string[]; now: number },
): Promise<void> {
	const keep = new Set(input.sourceIds);
	const existing = await db.all<SubscriptionRow>(
		`SELECT * FROM subscriptions WHERE user_id = ? AND channel_id = ?`,
		input.userId,
		input.channelId,
	);
	for (const row of existing) {
		if (!keep.has(row.source_id)) {
			await db.run(`DELETE FROM subscriptions WHERE id = ?`, row.id);
		}
	}
	for (const sourceId of input.sourceIds) {
		await db.run(
			`INSERT INTO subscriptions (user_id, channel_id, source_id, enabled, created_at, updated_at)
       VALUES (?, ?, ?, 1, ?, ?)
       ON CONFLICT(channel_id, source_id) DO UPDATE SET
         enabled = 1,
         updated_at = excluded.updated_at`,
			input.userId,
			input.channelId,
			sourceId,
			input.now,
			input.now,
		);
	}
}

export async function listSubscriptionsByUser(
	db: Db,
	userId: number,
): Promise<SubscriptionRow[]> {
	return db.all<SubscriptionRow>(
		`SELECT * FROM subscriptions WHERE user_id = ? ORDER BY source_id ASC`,
		userId,
	);
}

export async function setSubscriptionEnabled(
	db: Db,
	input: { userId: number; subscriptionId: number; enabled: boolean; now: number },
): Promise<boolean> {
	const result = await db.run(
		`UPDATE subscriptions
     SET enabled = ?, updated_at = ?
     WHERE id = ? AND user_id = ?`,
		input.enabled ? 1 : 0,
		input.now,
		input.subscriptionId,
		input.userId,
	);
	return (result.meta.changes ?? 0) > 0;
}

export async function listActiveChannelsForSource(
	db: Db,
	sourceId: string,
): Promise<SubscribedChannelRow[]> {
	return db.all<SubscribedChannelRow>(
		`SELECT c.*, s.source_id FROM feishu_channels c
     JOIN subscriptions s ON s.channel_id = c.id
     WHERE s.source_id = ?
       AND s.enabled = 1
       AND c.status = 'active'
     ORDER BY c.id ASC`,
		sourceId,
	);
}

export async function insertDelivery(
	db: Db,
	input: {
		channelId: number;
		sourceId: string;
		eventKind: string;
		itemId?: number;
		eventKey: string;
		status: DeliveryStatus;
		error?: string;
		sentAt?: number;
		createdAt: number;
	},
): Promise<boolean> {
	const result = await db.run(
		`INSERT OR IGNORE INTO notification_deliveries (
       channel_id, source_id, event_kind, item_id, event_key, status, error, sent_at, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		input.channelId,
		input.sourceId,
		input.eventKind,
		input.itemId ?? null,
		input.eventKey,
		input.status,
		input.error ?? null,
		input.sentAt ?? null,
		input.createdAt,
	);
	return (result.meta.changes ?? 0) > 0;
}

export async function updateDeliveryStatus(
	db: Db,
	input: {
		channelId: number;
		eventKey: string;
		status: DeliveryStatus;
		error?: string;
		sentAt?: number;
	},
): Promise<void> {
	await db.run(
		`UPDATE notification_deliveries
     SET status = ?, error = ?, sent_at = ?
     WHERE channel_id = ? AND event_key = ?`,
		input.status,
		input.error ?? null,
		input.sentAt ?? null,
		input.channelId,
		input.eventKey,
	);
}

export async function resetChannelFailures(db: Db, channelId: number, now: number): Promise<void> {
	await db.run(
		`UPDATE feishu_channels
     SET consecutive_failures = 0, last_error = NULL, updated_at = ?
     WHERE id = ?`,
		now,
		channelId,
	);
}

export async function recordChannelFailure(
	db: Db,
	input: { channelId: number; error: string; now: number; disableAtFailures: number },
): Promise<void> {
	const row = await db.first<{ consecutive_failures: number }>(
		`SELECT consecutive_failures FROM feishu_channels WHERE id = ? LIMIT 1`,
		input.channelId,
	);
	const failures = (row?.consecutive_failures ?? 0) + 1;
	const status = failures >= input.disableAtFailures ? 'error' : 'active';
	await db.run(
		`UPDATE feishu_channels
     SET consecutive_failures = ?, status = ?, last_error = ?, updated_at = ?
     WHERE id = ?`,
		failures,
		status,
		input.error,
		input.now,
		input.channelId,
	);
}
