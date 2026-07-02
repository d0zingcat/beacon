import type { Extractor } from '../extract/types';
import { registerSource } from './registry';
import type { RawItem, Source, SourceMode } from './types';

export function buildSource(
	base: {
		id: string;
		name: string;
		mode: SourceMode;
		normalize?: (raw: RawItem) => Omit<RawItem, 'raw'>;
		diff?: Source['diff'];
	},
	extractor: Extractor,
): Source {
	return {
		...base,
		kind: extractor.kind,
		async fetch(ctx) {
			return extractor.extract(ctx);
		},
	};
}

export function createSource(
	base: {
		id: string;
		name: string;
		mode: SourceMode;
		normalize?: (raw: RawItem) => Omit<RawItem, 'raw'>;
		diff?: Source['diff'];
	},
	extractor: Extractor,
): Source {
	const source = buildSource(base, extractor);
	registerSource(source);
	return source;
}
