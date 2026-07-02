import { feishuTransport } from './feishu';
import { telegramTransport } from './telegram';
import type { NotificationEvent } from './types';

export interface NotifierTransport {
	readonly id: 'telegram' | 'feishu';
	isConfigured(env: Env): boolean;
	send(env: Env, event: NotificationEvent): Promise<void>;
}

const allTransports: NotifierTransport[] = [telegramTransport, feishuTransport];

export function createTransports(env: Env): NotifierTransport[] {
	return allTransports.filter((transport) => transport.isConfigured(env));
}
