import './sources/examples';
import type { CrawlMessage } from './env';
import app from './router';
import { runScheduler } from './scheduler';
import { handleQueue } from './queue/consumer';

export default {
	async fetch(request, env, ctx) {
		return app.fetch(request, env, ctx);
	},
	async scheduled(_event, env, ctx) {
		ctx.waitUntil(runScheduler(env));
	},
	async queue(batch, env, ctx) {
		ctx.waitUntil(handleQueue(batch as MessageBatch<CrawlMessage>, env));
	},
} satisfies ExportedHandler<Env>;
