import { MAX_NOTIFICATION_TEXT_LENGTH } from '../config';

const TRUNCATION_SUFFIX = '\n…（消息已截断）';

export function truncateNotificationText(
	text: string,
	maxLength: number = MAX_NOTIFICATION_TEXT_LENGTH,
): string {
	if (text.length <= maxLength) {
		return text;
	}
	const budget = Math.max(0, maxLength - TRUNCATION_SUFFIX.length);
	return text.slice(0, budget) + TRUNCATION_SUFFIX;
}
