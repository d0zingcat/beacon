/** First successful append crawl for an empty source should seed quietly (no notify flood). */
export function shouldSilenceAppendSeed(priorItemCount: number): boolean {
	return priorItemCount === 0;
}
