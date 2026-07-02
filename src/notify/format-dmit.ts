const DIFF_FIELD_LABELS: Record<string, string> = {
	available: '📦 库存',
	price: '💰 价格',
	billingCycle: '📅 计费周期',
};

const STOCK_STATUS_TEXT = new Set(['缺货', '有货', 'Out of Stock']);

type DiffChange = { from: unknown; to: unknown };

function isDiffChange(value: unknown): value is DiffChange {
	return (
		typeof value === 'object' &&
		value !== null &&
		'from' in value &&
		'to' in value
	);
}

function formatDiffValue(key: string, value: unknown): string {
	if (key === 'available') {
		if (value === true) return '✅ 有货';
		if (value === false) return '❌ 缺货';
	}
	if (value === null || value === undefined) return '—';
	return String(value);
}

function resolveDisplayPrice(
	diff: Record<string, unknown>,
	summary?: string,
): string | undefined {
	const priceChange = diff.price;
	if (isDiffChange(priceChange) && priceChange.to != null) {
		return formatDiffValue('price', priceChange.to);
	}

	const availableChange = diff.available;
	if (
		isDiffChange(availableChange) &&
		availableChange.to === true &&
		summary &&
		!STOCK_STATUS_TEXT.has(summary)
	) {
		return summary;
	}

	return undefined;
}

function formatSnapshot(snapshot: Record<string, unknown>): string[] {
	const lines: string[] = [];
	for (const [key, value] of Object.entries(snapshot)) {
		if (key === 'source' || value == null) continue;
		const label = DIFF_FIELD_LABELS[key] ?? key;
		lines.push(`${label}: ${formatDiffValue(key, value)}`);
	}
	return lines;
}

export function formatDmitStateDiff(
	diff: Record<string, unknown>,
	summary?: string,
): string[] {
	if ('snapshot' in diff && typeof diff.snapshot === 'object' && diff.snapshot) {
		return formatSnapshot(diff.snapshot as Record<string, unknown>);
	}

	const lines: string[] = [];
	for (const [key, change] of Object.entries(diff)) {
		if (key === 'source' || !isDiffChange(change)) continue;
		const label = DIFF_FIELD_LABELS[key] ?? key;
		lines.push(
			`${label}: ${formatDiffValue(key, change.from)} → ${formatDiffValue(key, change.to)}`,
		);
	}

	const price = resolveDisplayPrice(diff, summary);
	if (price && !lines.some((line) => line.startsWith('💰 价格:'))) {
		lines.push(`${DIFF_FIELD_LABELS.price}: ${price}`);
	}

	return lines;
}

export function formatDmitStateChangeEvent(input: {
	sourceName: string;
	title: string;
	url?: string;
	summary?: string;
	diff?: Record<string, unknown>;
}): string {
	const lines = [`🔔 [beacon] 状态变化 · ${input.sourceName}`, input.title];
	if (input.diff && Object.keys(input.diff).length > 0) {
		const diffLines = formatDmitStateDiff(input.diff, input.summary);
		if (diffLines.length > 0) {
			lines.push(...diffLines);
		} else if (input.summary) {
			lines.push(input.summary);
		}
	} else if (input.summary) {
		lines.push(input.summary);
	}
	if (input.url) lines.push(`🔗 ${input.url}`);
	return lines.join('\n');
}
