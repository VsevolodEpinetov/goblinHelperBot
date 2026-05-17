import 'dotenv/config';

import type { Knex } from 'knex';

const baseConnection = {
  host: process.env.DB_HOST ?? 'localhost',
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
  database: process.env.DB_NAME ?? 'goblin_bot',
  user: process.env.DB_USER ?? 'goblin',
  password: process.env.DB_PASSWORD ?? '',
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
