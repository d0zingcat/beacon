import type { BrowserWorker, Page } from '@cloudflare/playwright';

export type SourceKind = 'rss' | 'browser' | 'api';
export type SourceMode = 'append' | 'state';

export interface RawItem {
	externalId: string;
	url: string;
	title: string;
	summary?: string;
	content?: string;
	publishedAt?: string;
	state?: Record<string, unknown>;
	raw?: Record<string, unknown>;
}

export interface SourceContext {
	env: Env;
	fetch: typeof fetch;
	browser?: BrowserWorker;
}

export interface Source {
	id: string;
	name: string;
	kind: SourceKind;
	mode: SourceMode;
	schedule: string;
	fetch(ctx: SourceContext): Promise<RawItem[]>;
	normalize?(raw: RawItem): Omit<RawItem, 'raw'>;
	diff?(prev: Record<string, unknown>, next: Record<string, unknown>): boolean;
}

export interface NotifyEvent {
	type: 'append' | 'state_change';
	sourceId: string;
	sourceName: string;
	itemId: number;
	title: string;
	url?: string;
	summary?: string;
	diff?: Record<string, unknown>;
}

export type { BrowserWorker, Page };
