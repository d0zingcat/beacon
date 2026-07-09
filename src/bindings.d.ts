// Secrets configured via `wrangler secret put` (not reflected by `wrangler types`).
interface Env {
	FEISHU_WEBHOOK_URL?: string;
	TELEGRAM_BOT_TOKEN?: string;
	TELEGRAM_CHAT_ID?: string;
	DMIT_AFF_ID?: string;
	RUN_TOKEN?: string;
	APP_ENV?: string;
	WEBHOOK_ENCRYPTION_KEY?: string;
	EMAIL?: {
		send(message: {
			to: string;
			from: { email: string; name?: string };
			subject: string;
			html?: string;
			text?: string;
		}): Promise<unknown>;
	};
}
