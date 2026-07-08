import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';
import { configDefaults } from 'vitest/config';

export default defineWorkersConfig({
	test: {
		// Manual debugging scripts that bundle gitignored `.dev.vars` via `?raw`.
		// Excluded from the default run so CI (which has no `.dev.vars`) doesn't
		// fail to resolve the import. Run them locally with `pnpm test:manual`.
		exclude: [...configDefaults.exclude, 'scripts/force-notify-*.test.ts'],
		poolOptions: {
			workers: {
				wrangler: { configPath: './wrangler.jsonc' },
			},
		},
	},
});
