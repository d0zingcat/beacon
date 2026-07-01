import { feishuTransport } from './feishu';
import { telegramTransport } from './telegram';

export interface NotifierTransport {
	readonly id: 'telegram' | 'feishu';
	isConfigured(env: Env): boolean;
	send(env: Env, text: string): Promise<void>;
}

const allTransports: NotifierTransport[] = [telegramTransport, feishuTransport];

export function createTransports(env: Env): NotifierTransport[] {
	return allTransports.filter((transport) => transport.isConfigured(env));
}
