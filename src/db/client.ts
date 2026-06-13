import 'dotenv/config';

import knexLib from 'knex';
import type { Knex } from 'knex';

const env = process.env.NODE_ENV ?? 'development';

// Fall back to the standard libpq env vars (PGHOST/PGPORT/…) when our own
// DB_* names are absent. DB_* take precedence when set. Keep this in sync
// with knexfile.ts and src/core/config.ts.
function buildConfig(): Knex.Config {
  const isTest = env === 'test';
  const database = isTest
    ? (process.env.DB_TEST_NAME ?? 'goblin_test')
    : (process.env.DB_NAME ?? process.env.PGDATABASE ?? 'goblin_bot');

  return {
    client: 'pg',
    connection: {
      host: process.env.DB_HOST ?? process.env.PGHOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? process.env.PGPORT ?? 5432),
      database,
      user: process.env.DB_USER ?? process.env.PGUSER ?? 'goblin',
      password: process.env.DB_PASSWORD ?? process.env.PGPASSWORD ?? '',
    },
    pool: isTest ? { min: 0, max: 5 } : { min: 0, max: 10 },
  };
}

export const db: Knex = knexLib(buildConfig());

export type DbConn = Knex | Knex.Transaction;
