import 'dotenv/config';

import type { Knex } from 'knex';

// Fall back to the standard libpq env vars (PGHOST/PGPORT/…) when our own
// DB_* names are absent, so the same .env works locally and on a prod box that
// uses the libpq convention. DB_* take precedence when set. Keep this in sync
// with src/core/config.ts.
const baseConnection = {
  host: process.env.DB_HOST ?? process.env.PGHOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? process.env.PGPORT ?? 5432),
  database: process.env.DB_NAME ?? process.env.PGDATABASE ?? 'goblin_bot',
  user: process.env.DB_USER ?? process.env.PGUSER ?? 'goblin',
  password: process.env.DB_PASSWORD ?? process.env.PGPASSWORD ?? '',
};

const migrationConfig: Knex.MigratorConfig = {
  directory: ['./src/db/migrations/legacy', './src/db/migrations'],
  sortDirsSeparately: false,
  loadExtensions: ['.js', '.ts'],
  extension: 'ts',
};

const config: Record<string, Knex.Config> = {
  development: {
    client: 'pg',
    connection: baseConnection,
    pool: { min: 0, max: 10 },
    migrations: migrationConfig,
  },
  test: {
    client: 'pg',
    connection: {
      ...baseConnection,
      database: process.env.DB_TEST_NAME ?? 'goblin_test',
    },
    pool: { min: 0, max: 5 },
    migrations: migrationConfig,
  },
  production: {
    client: 'pg',
    connection: baseConnection,
    pool: { min: 2, max: 20 },
    migrations: migrationConfig,
  },
};

export default config;
module.exports = config;
