export function formatPublishedAt(epochMs: number): string {
	return new Intl.DateTimeFormat('zh-CN', {
		year: 'numeric',
		month: 'numeric',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		hour12: false,
		timeZone: 'Asia/Shanghai',
	}).format(epochMs);
}

export function formatTitleWithPublishedAt(title: string, publishedAt?: number): string {
	if (publishedAt === undefined) {
		return title;
	}
	return `${title} · ${formatPublishedAt(publishedAt)}`;
}
