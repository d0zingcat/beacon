import type { Extractor } from '../extract/types';
import { registerSource } from './registry';
import type { RawItem, Source, SourceMode } from './types';

export function createSource(
	base: {
		id: string;
		name: string;
		mode: SourceMode;
		schedule: string;
		normalize?: (raw: RawItem) => Omit<RawItem, 'raw'>;
		diff?: Source['diff'];
	},
	extractor: Extractor,
): Source {
	const source: Source = {
		...base,
		kind: extractor.kind,
		async fetch(ctx) {
			return extractor.extract(ctx);
		},
	};
	registerSource(source);
	return source;
}
