export interface AppendNotificationItem {
	itemId: number;
	title: string;
	url?: string;
	publishedAt?: number;
}

export type NotificationEvent =
	| {
			kind: 'append';
			sourceId: string;
			sourceName: string;
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
