import type { Db } from '../db/client';
import { buildFeishuNotificationPayload, sendFeishuWebhook } from '../notify/feishu';
import type { NotificationEvent } from '../notify/types';
import { decryptSecret } from './crypto';
import {
	insertDelivery,
	listActiveChannelsForSource,
	recordChannelFailure,
	resetChannelFailures,
	updateDeliveryStatus,
	type SubscribedChannelRow,
} from './repo';

const DISABLE_CHANNEL_AFTER_FAILURES = 5;

export interface DispatchUserSubscriptionsDeps {
	listActiveChannelsForSource?: typeof listActiveChannelsForSource;
	decryptSecret?: typeof decryptSecret;
	sendWebhook?: typeof sendFeishuWebhook;
	insertDelivery?: typeof insertDelivery;
	updateDeliveryStatus?: typeof updateDeliveryStatus;
	recordChannelFailure?: typeof recordChannelFailure;
	resetChannelFailures?: typeof resetChannelFailures;
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function eventItemId(event: NotificationEvent): number | undefined {
	if (event.kind === 'append' || event.kind === 'state_change') {
		return event.itemId;
	}
	return undefined;
}

export function buildDeliveryEventKey(event: NotificationEvent): string {
	switch (event.kind) {
		case 'append':
			return `append:${event.itemId}`;
		case 'state_change':
			return `state:${event.itemId}:${event.publishedAt ?? 'latest'}`;
		case 'append_batch':
			return `append_batch:${event.sourceId}:${event.items.map((item) => item.itemId).join(',')}`;
		case 'crawl_error':
			return `crawl_error:${event.sourceId}:${event.error}`;
	}
}

async function sendToChannel(
	env: Env,
	db: Db,
	event: NotificationEvent,
	channel: SubscribedChannelRow,
	deps: Required<DispatchUserSubscriptionsDeps>,
	now: number,
): Promise<void> {
	const eventKey = buildDeliveryEventKey(event);
	const inserted = await deps.insertDelivery(db, {
		channelId: channel.id,
		sourceId: event.sourceId,
		eventKind: event.kind,
		itemId: eventItemId(event),
		eventKey,
		status: 'skipped',
		createdAt: now,
	});
	if (!inserted) {
		return;
	}
	try {
		if (!env.WEBHOOK_ENCRYPTION_KEY) {
			throw new Error('WEBHOOK_ENCRYPTION_KEY is not configured');
		}
		const webhookUrl = await deps.decryptSecret(
			channel.webhook_ciphertext,
			env.WEBHOOK_ENCRYPTION_KEY,
		);
		await deps.sendWebhook(webhookUrl, buildFeishuNotificationPayload(event));
		await deps.updateDeliveryStatus(db, {
			channelId: channel.id,
			eventKey,
			status: 'sent',
			sentAt: now,
		});
		await deps.resetChannelFailures(db, channel.id, now);
	} catch (error) {
		await deps.updateDeliveryStatus(db, {
			channelId: channel.id,
			eventKey,
			status: 'failed',
			error: errorMessage(error),
		});
		await deps.recordChannelFailure(db, {
			channelId: channel.id,
			error: errorMessage(error),
			now,
			disableAtFailures: DISABLE_CHANNEL_AFTER_FAILURES,
		});
	}
}

export async function dispatchUserSubscriptions(
	env: Env,
	db: Db,
	events: NotificationEvent[],
	deps: DispatchUserSubscriptionsDeps = {},
): Promise<void> {
	if (events.length === 0) {
		return;
	}
	const resolved: Required<DispatchUserSubscriptionsDeps> = {
		listActiveChannelsForSource: deps.listActiveChannelsForSource ?? listActiveChannelsForSource,
		decryptSecret: deps.decryptSecret ?? decryptSecret,
		sendWebhook: deps.sendWebhook ?? sendFeishuWebhook,
		insertDelivery: deps.insertDelivery ?? insertDelivery,
		updateDeliveryStatus: deps.updateDeliveryStatus ?? updateDeliveryStatus,
		recordChannelFailure: deps.recordChannelFailure ?? recordChannelFailure,
		resetChannelFailures: deps.resetChannelFailures ?? resetChannelFailures,
	};

	for (const event of events) {
		const channels = await resolved.listActiveChannelsForSource(db, event.sourceId);
		const now = Date.now();
		for (const channel of channels) {
			await sendToChannel(env, db, event, channel, resolved, now);
		}
	}
}
