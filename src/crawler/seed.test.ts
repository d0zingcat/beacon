import { describe, expect, it } from 'vitest';
import { shouldSilenceAppendSeed } from './seed';

describe('shouldSilenceAppendSeed', () => {
	it('silences notifications when the source has no prior items', () => {
		expect(shouldSilenceAppendSeed(0)).toBe(true);
	});

	it('allows notifications once the source already has items', () => {
		expect(shouldSilenceAppendSeed(1)).toBe(false);
		expect(shouldSilenceAppendSeed(65)).toBe(false);
	});
});
