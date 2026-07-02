// Secrets configured via `wrangler secret put` (not reflected by `wrangler types`).
interface Env {
	FEISHU_WEBHOOK_URL: string;
	TELEGRAM_BOT_TOKEN?: string;
	TELEGRAM_CHAT_ID?: string;
	DMIT_AFF_ID?: string;
}
