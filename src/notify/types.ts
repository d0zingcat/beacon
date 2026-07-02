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
