import type { Source } from './types';

const registry = new Map<string, Source>();

export function registerSource(source: Source): void {
	registry.set(source.id, source);
}

export function getSource(id: string): Source | undefined {
	return registry.get(id);
}

export function listSources(): Source[] {
	return [...registry.values()];
}
