import type { RawItem, SourceContext } from '../sources/types';

export type ExtractorKind = 'feed' | 'webpage' | 'browser';

export interface Extractor {
	kind: ExtractorKind;
	extract(ctx: SourceContext): Promise<RawItem[]>;
}
