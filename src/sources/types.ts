import type { BrowserWorker, Page } from '@cloudflare/puppeteer';

export type SourceKind = 'feed' | 'webpage' | 'browser';
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
	fetch(ctx: SourceContext): Promise<RawItem[]>;
	normalize?(raw: RawItem): Omit<RawItem, 'raw'>;
	diff?(prev: Record<string, unknown>, next: Record<string, unknown>): boolean;
}

export type { BrowserWorker, Page };
