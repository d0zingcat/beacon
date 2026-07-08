export interface AppendNotificationItem {
	itemId: number;
	title: string;
	url?: string;
	publishedAt?: number;
}

/**
 * Extractor kind the append event originated from. Drives how `summary` is
 * rendered: `feed` summaries are HTML fragments, others are plain text.
 */
export type AppendSourceKind = 'feed' | 'webpage' | 'browser';

export type NotificationEvent =
	| {
			kind: 'append';
			sourceId: string;
			sourceName: string;
			sourceKind: AppendSourceKind;
			itemId: number;
			title: string;
			url?: string;
			summary?: string;
			publishedAt?: number;
	  }
	| {
			kind: 'append_batch';
			sourceId: string;
			sourceName: string;
			sourceKind: AppendSourceKind;
			items: AppendNotificationItem[];
			/** Max items to list before an overflow footer (per-source config). */
			maxItems: number;
	  }
	| {
			kind: 'state_change';
			sourceId: string;
			sourceName: string;
			itemId: number;
			title: string;
			url?: string;
			summary?: string;
			publishedAt?: number;
			diff?: Record<string, unknown>;
	  }
	| {
			kind: 'crawl_error';
			sourceId: string;
			sourceName: string;
			error: string;
			suppress?: boolean;
	  };
