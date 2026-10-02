export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 100;

/** Max append items listed in a merged batch notification (per-source override). */
export const DEFAULT_BATCH_NOTIFY_MAX_ITEMS = 10;

/**
 * Append items published more than this many days ago are stored quietly and
 * never notified (per-source override via `Source.notifyMaxAgeDays`). Guards
 * against upstream changelog re-keys surfacing year-old entries as "new".
 */
export const DEFAULT_APPEND_NOTIFY_MAX_AGE_DAYS = 7;

/** Telegram / Feishu safe text limit with room for truncation suffix. */
export const MAX_NOTIFICATION_TEXT_LENGTH = 4_000;
