import type { Source } from './types';

const staticRegistry = new Map<string, Source>();
const dynamicRegistry = new Map<string, Source>();

export function registerSource(source: Source): void {
	staticRegistry.set(source.id, source);
}

export function registerDynamicSource(source: Source): void {
	dynamicRegistry.set(source.id, source);
}

export function clearDynamicSources(): void {
	dynamicRegistry.clear();
}

export function isStaticSource(id: string): boolean {
	return staticRegistry.has(id);
}

export function getSource(id: string): Source | undefined {
	return staticRegistry.get(id) ?? dynamicRegistry.get(id);
}

export function listSources(): Source[] {
	return [...staticRegistry.values(), ...dynamicRegistry.values()];
}
