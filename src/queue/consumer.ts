import type { CrawlMessage } from '../env';
import { runSource } from '../crawler/runner';

export async function handleQueue(batch: MessageBatch<CrawlMessage>, env: Env): Promise<void> {
	for (const message of batch.messages) {
		const { sourceId, forceNotify } = message.body;
		const result = await runSource(env, sourceId, { forceNotify });
		if (result.status === 'error') {
			console.error(`Queue run failed for ${sourceId}: ${result.error}`);
		}
		message.ack();
	}
}
