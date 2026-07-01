import type { CrawlMessage } from '../env';
import { runSource } from '../crawler/runner';

export async function handleQueue(batch: MessageBatch<CrawlMessage>, env: Env): Promise<void> {
	for (const message of batch.messages) {
		const { sourceId } = message.body;
		const result = await runSource(env, sourceId);
		if (result.status === 'error') {
			console.error(`Queue run failed for ${sourceId}: ${result.error}`);
		}
		message.ack();
	}
}
