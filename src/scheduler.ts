import { listSources } from './sources/registry';

export async function runScheduler(env: Env): Promise<void> {
	// TODO: 按每个 source.schedule 精确匹配 cron tick
	const sources = listSources();
	await Promise.all(
		sources.map((source) =>
			env.CRAWL_QUEUE.send({
				sourceId: source.id,
				triggeredAt: Date.now(),
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
