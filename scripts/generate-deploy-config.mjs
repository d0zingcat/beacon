import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseJsonc } from './parse-jsonc.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const baseConfigPath = join(root, 'wrangler.jsonc');
const deployConfigPath = join(root, '.wrangler/deploy/wrangler.jsonc');

const databaseId = process.env.D1_DATABASE_ID?.trim();
if (!databaseId) {
	console.error('D1_DATABASE_ID is required (env var or GitHub Actions secret).');
	process.exit(1);
}

const config = parseJsonc(readFileSync(baseConfigPath, 'utf8'));
const d1Binding = config.d1_databases?.find((db) => db.binding === 'DB');
if (!d1Binding) {
	console.error('wrangler.jsonc must define a D1 binding named "DB".');
	process.exit(1);
}

d1Binding.database_id = databaseId;
// Deploy config lives in .wrangler/deploy/; paths are relative to that file.
d1Binding.migrations_dir = '../../migrations';
if (typeof config.main === 'string' && !config.main.startsWith('../')) {
	config.main = `../../${config.main}`;
}

mkdirSync(dirname(deployConfigPath), { recursive: true });
writeFileSync(deployConfigPath, `${JSON.stringify(config, null, '\t')}\n`);
console.log(`Generated ${deployConfigPath} (database_id from D1_DATABASE_ID)`);
