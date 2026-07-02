import { listSources } from './sources/registry';
import type { Source } from './sources/types';

/** Which built-in sources run on each Cloudflare cron trigger (see wrangler.jsonc). */
const QUARTER_HOURLY_SOURCE_IDS = new Set(['dmit-stock']);
const SIX_HOURLY_SOURCE_IDS = new Set(['bedrock-models']);

export function selectSourcesForTick(wranglerCron: string): Source[] {
	const sources = listSources();

	switch (wranglerCron) {
		case '*/15 * * * *':
			return sources.filter((source) => QUARTER_HOURLY_SOURCE_IDS.has(source.id));
		case '0 */6 * * *':
			return sources.filter((source) => SIX_HOURLY_SOURCE_IDS.has(source.id));
		case '0 * * * *':
			return sources.filter(
				(source) =>
					!QUARTER_HOURLY_SOURCE_IDS.has(source.id) && !SIX_HOURLY_SOURCE_IDS.has(source.id),
			);
		default:
			console.warn(`Unknown wrangler cron "${wranglerCron}", skipping`);
			return [];
	}
}

export async function runScheduler(
	env: Env,
	wranglerCron: string,
	scheduledTime: number,
): Promise<void> {
	const sources = selectSourcesForTick(wranglerCron);
	await Promise.all(
		sources.map((source) =>
			env.CRAWL_QUEUE.send({
				sourceId: source.id,
				triggeredAt: scheduledTime,
			}),
		),
	);
}

export async function enqueueSource(
	env: Env,
	sourceId: string,
	options?: { forceNotify?: boolean },
): Promise<void> {
	await env.CRAWL_QUEUE.send({
		sourceId,
		triggeredAt: Date.now(),
		forceNotify: options?.forceNotify,
	});
}
