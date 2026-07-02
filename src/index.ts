import './sources/examples';
import type { CrawlMessage } from './env';
import app from './router';
import { runScheduler } from './scheduler';
import { handleQueue } from './queue/consumer';
import { ensureSourcesLoaded } from './sources/load-from-db';

export default {
	async fetch(request, env, ctx) {
		return app.fetch(request, env, ctx);
	},
	async scheduled(event, env, ctx) {
		ctx.waitUntil(
			(async () => {
				await ensureSourcesLoaded(env);
				await runScheduler(env, event.cron, event.scheduledTime);
			})(),
		);
	},
	async queue(batch, env, ctx) {
		ctx.waitUntil(
			(async () => {
				await ensureSourcesLoaded(env);
				await handleQueue(batch as MessageBatch<CrawlMessage>, env);
			})(),
		);
	},
} satisfies ExportedHandler<Env>;
