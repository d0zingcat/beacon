import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

// Runs the manual debugging scripts under scripts/force-notify-*.test.ts,
// which bundle the gitignored `.dev.vars` via `?raw` and send real messages to
// configured webhooks. Intended for local use via `pnpm test:manual` only — do
// not run in CI (no `.dev.vars` checked in).
export default defineWorkersConfig({
	test: {
		include: ['scripts/force-notify-*.test.ts'],
		poolOptions: {
			workers: {
				wrangler: { configPath: './wrangler.jsonc' },
			},
		},
	},
});
