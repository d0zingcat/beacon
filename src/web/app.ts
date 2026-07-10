import { Hono } from 'hono';
import { createDb } from '../db/client';
import type { CurrentUser } from '../auth/session';
import { getCurrentUser as defaultGetCurrentUser } from '../auth/session';
import { listSources as defaultListSources } from '../sources/registry';
import type { Source } from '../sources/types';
import { buildFeishuTextPayload, sendFeishuWebhook } from '../notify/feishu';
import {
	deleteFeishuChannelForUser,
	getFeishuChannelForUser,
	listFeishuChannelsByUser,
	listSubscriptionsByUser,
	replaceSubscriptions,
	setSubscriptionEnabled as setSubscriptionEnabledInDb,
	upsertFeishuChannel,
	type FeishuChannelRow,
	type SubscriptionRow,
} from '../subscriptions/repo';
import {
	encryptSecret,
	fingerprintSecret,
	maskWebhookUrl,
} from '../subscriptions/crypto';
import { escapeHtml, page } from './render';

export interface AppRouteDeps {
	getCurrentUser?: (env: Env, cookieHeader?: string) => Promise<CurrentUser | null>;
	listSources?: () => Source[];
	listChannels?: (env: Env, user: CurrentUser) => Promise<FeishuChannelRow[]>;
	listSubscriptions?: (env: Env, user: CurrentUser) => Promise<SubscriptionRow[]>;
	sendTestMessage?: (env: Env, webhookUrl: string) => Promise<void>;
	saveFeishuChannel?: (
		env: Env,
		user: CurrentUser,
		displayName: string,
		webhookUrl: string,
	) => Promise<number>;
	saveSubscriptions?: (
		env: Env,
		user: CurrentUser,
		channelId: number,
		sourceIds: string[],
	) => Promise<void>;
	setSubscriptionEnabled?: (
		env: Env,
		user: CurrentUser,
		subscriptionId: number,
		enabled: boolean,
	) => Promise<boolean>;
}

type AppRouteEnv = {
	Bindings: Env;
	Variables: {
		user: CurrentUser;
	};
};

async function parseForm(request: Request): Promise<Record<string, string | string[]>> {
	const form = await request.formData();
	const result: Record<string, string | string[]> = {};
	for (const [key, value] of form) {
		if (typeof value !== 'string') continue;
		const existing = result[key];
		if (Array.isArray(existing)) {
			existing.push(value);
		} else if (typeof existing === 'string') {
			result[key] = [existing, value];
		} else {
			result[key] = value;
		}
	}
	return result;
}

function first(value: string | string[] | undefined): string {
	return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function all(value: string | string[] | undefined): string[] {
	if (Array.isArray(value)) return value;
	if (typeof value === 'string' && value.length > 0) return [value];
	return [];
}

function validateFeishuWebhook(url: string): boolean {
	try {
		const parsed = new URL(url);
		return parsed.protocol === 'https:' &&
			parsed.hostname === 'open.feishu.cn' &&
			parsed.pathname.startsWith('/open-apis/bot/v2/hook/');
	} catch {
		return false;
	}
}

async function requireUser(
	env: Env,
	cookieHeader: string | undefined,
	getCurrentUser: NonNullable<AppRouteDeps['getCurrentUser']>,
): Promise<CurrentUser | null> {
	return getCurrentUser(env, cookieHeader);
}

async function defaultSaveFeishuChannel(
	env: Env,
	user: CurrentUser,
	displayName: string,
	webhookUrl: string,
): Promise<number> {
	if (!env.WEBHOOK_ENCRYPTION_KEY) {
		throw new Error('WEBHOOK_ENCRYPTION_KEY is not configured');
	}
	return upsertFeishuChannel(createDb(env), {
		userId: user.id,
		displayName,
		webhookCiphertext: await encryptSecret(webhookUrl, env.WEBHOOK_ENCRYPTION_KEY),
		webhookFingerprint: await fingerprintSecret(webhookUrl),
		webhookMask: maskWebhookUrl(webhookUrl),
		now: Date.now(),
	});
}

async function defaultSaveSubscriptions(
	env: Env,
	user: CurrentUser,
	channelId: number,
	sourceIds: string[],
): Promise<void> {
	const db = createDb(env);
	const channel = await getFeishuChannelForUser(db, { userId: user.id, channelId });
	if (!channel) {
		throw new Error('Feishu channel not found');
	}
	const valid = new Set(defaultListSources().map((source) => source.id));
	await replaceSubscriptions(db, {
		userId: user.id,
		channelId,
		sourceIds: sourceIds.filter((sourceId) => valid.has(sourceId)),
		now: Date.now(),
	});
}

function sourceGroupLabel(source: Source): string {
	if (source.id === 'bedrock-models') return 'Model catalogs';
	if (source.mode === 'state') return 'Infrastructure';
	return 'Blogs and changelogs';
}

function renderSubscriptionPage(input: {
	user: CurrentUser;
	sources: Source[];
	channels: FeishuChannelRow[];
	subscriptions: SubscriptionRow[];
}): string {
	const selected = new Set(input.subscriptions.filter((row) => row.enabled).map((row) => row.source_id));
	const channel = input.channels[0];
	const channelInfo = channel
		? `<p class="meta">${escapeHtml(channel.display_name)} · ${escapeHtml(channel.status)} · ${escapeHtml(channel.webhook_mask)}</p>`
		: '<p class="meta">No Feishu webhook connected.</p>';
	const disabled = channel ? '' : ' disabled';
	const groups = new Map<string, Source[]>();
	for (const source of input.sources) {
		const label = sourceGroupLabel(source);
		groups.set(label, [...(groups.get(label) ?? []), source]);
	}
	const sourceList = [...groups.entries()]
		.map(([label, sources]) =>
			`<fieldset class="panel"><legend>${escapeHtml(label)}</legend>${sources
				.map(
					(source) =>
						`<label class="source"><input type="checkbox" name="sourceId" value="${escapeHtml(source.id)}"${selected.has(source.id) ? ' checked' : ''}${disabled}> ${escapeHtml(source.name)} <span class="meta">${escapeHtml(source.mode)}</span></label>`,
				)
				.join('')}</fieldset>`,
		)
		.join('');
	const channelId = channel ? `<input type="hidden" name="channelId" value="${channel.id}">` : '';
	const subscriptionControls = input.subscriptions
		.map((subscription) => {
			const source = input.sources.find((item) => item.id === subscription.source_id);
			const action = subscription.enabled ? 'pause' : 'resume';
			const label = subscription.enabled ? 'Pause' : 'Resume';
			return `<form method="post" action="/app/subscriptions/${subscription.id}/${action}"><span>${escapeHtml(source?.name ?? subscription.source_id)}</span> <button type="submit">${label}</button></form>`;
		})
		.join('');
	return page(
		'Beacon subscriptions',
		`<section class="panel"><h1>Subscriptions</h1><p>${escapeHtml(input.user.email)}</p>${channelInfo}</section>
<section class="panel"><h2>Feishu webhook</h2><form method="post" action="/app/feishu-channels"><input name="displayName" placeholder="Bot name" required> <input name="webhookUrl" placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/..." required> <button type="submit">Test and save</button></form></section>
<section class="panel"><h2>Sources</h2><form method="post" action="/app/subscriptions">${channelId}<div class="grid">${sourceList}</div><p><button type="submit"${disabled}>Save subscriptions</button></p></form></section>
<section class="panel"><h2>Active subscriptions</h2>${subscriptionControls}</section>`,
	);
}

export function createAppRoutes(deps: AppRouteDeps = {}): Hono<AppRouteEnv> {
	const app = new Hono<AppRouteEnv>();
	const getCurrentUser =
		deps.getCurrentUser ??
		((env, cookieHeader) => defaultGetCurrentUser(createDb(env), cookieHeader));
	const getSources = deps.listSources ?? defaultListSources;
	const listChannels =
		deps.listChannels ?? ((env, user) => listFeishuChannelsByUser(createDb(env), user.id));
	const listSubscriptions =
		deps.listSubscriptions ?? ((env, user) => listSubscriptionsByUser(createDb(env), user.id));
	const sendTestMessage =
		deps.sendTestMessage ??
		((_env, webhookUrl) =>
			sendFeishuWebhook(webhookUrl, buildFeishuTextPayload('Beacon Feishu webhook test succeeded.')));
	const saveFeishuChannel = deps.saveFeishuChannel ?? defaultSaveFeishuChannel;
	const saveSubscriptions = deps.saveSubscriptions ?? defaultSaveSubscriptions;
	const setSubscriptionEnabled =
		deps.setSubscriptionEnabled ??
		((env, user, subscriptionId, enabled) =>
			setSubscriptionEnabledInDb(createDb(env), {
				userId: user.id,
				subscriptionId,
				enabled,
				now: Date.now(),
			}));

	app.use('/app/*', async (c, next) => {
		const user = await requireUser(c.env, c.req.header('cookie'), getCurrentUser);
		if (!user) {
			return c.redirect('/login');
		}
		c.set('user', user);
		await next();
	});

	app.get('/app/subscriptions', async (c) => {
		const user = c.get('user') as CurrentUser;
		const [channels, subscriptions] = await Promise.all([
			listChannels(c.env, user),
			listSubscriptions(c.env, user),
		]);
		return c.html(renderSubscriptionPage({
			user,
			sources: getSources(),
			channels,
			subscriptions,
		}));
	});

	app.post('/app/feishu-channels', async (c) => {
		const user = c.get('user') as CurrentUser;
		const form = await parseForm(c.req.raw);
		const webhookUrl = first(form.webhookUrl).trim();
		const displayName = first(form.displayName).trim() || 'Feishu bot';
		if (!validateFeishuWebhook(webhookUrl)) {
			return c.html(page('Invalid webhook', '<p>Invalid Feishu webhook URL.</p>'), 400);
		}
		await sendTestMessage(c.env, webhookUrl);
		await saveFeishuChannel(c.env, user, displayName, webhookUrl);
		return c.redirect('/app/subscriptions');
	});

	app.post('/app/subscriptions', async (c) => {
		const user = c.get('user') as CurrentUser;
		const form = await parseForm(c.req.raw);
		const channelId = Number(first(form.channelId));
		if (!Number.isFinite(channelId)) {
			return c.html(page('Invalid channel', '<p>Invalid Feishu channel.</p>'), 400);
		}
		await saveSubscriptions(c.env, user, channelId, all(form.sourceId));
		return c.redirect('/app/subscriptions');
	});

	app.post('/app/subscriptions/:id/pause', async (c) => {
		const user = c.get('user') as CurrentUser;
		await setSubscriptionEnabled(c.env, user, Number(c.req.param('id')), false);
		return c.redirect('/app/subscriptions');
	});

	app.post('/app/subscriptions/:id/resume', async (c) => {
		const user = c.get('user') as CurrentUser;
		await setSubscriptionEnabled(c.env, user, Number(c.req.param('id')), true);
		return c.redirect('/app/subscriptions');
	});

	app.post('/app/feishu-channels/:id/delete', async (c) => {
		const user = c.get('user') as CurrentUser;
		await deleteFeishuChannelForUser(createDb(c.env), {
			userId: user.id,
			channelId: Number(c.req.param('id')),
		});
		return c.redirect('/app/subscriptions');
	});

	return app;
}
