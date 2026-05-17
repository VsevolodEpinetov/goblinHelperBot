import 'dotenv/config';

import knexLib from 'knex';
import type { Knex } from 'knex';

const env = process.env.NODE_ENV ?? 'development';

function buildConfig(): Knex.Config {
  const isTest = env === 'test';
  const database = isTest
    ? (process.env.DB_TEST_NAME ?? 'goblin_test')
    : (process.env.DB_NAME ?? 'goblin_bot');

  return {
    client: 'pg',
    connection: {
      host: process.env.DB_HOST ?? 'localhost',
      port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
      database,
      user: process.env.DB_USER ?? 'goblin',
      password: process.env.DB_PASSWORD ?? '',
    },
    pool: isTest ? { min: 0, max: 5 } : { min: 0, max: 10 },
  };
}

export const db: Knex = knexLib(buildConfig());

export type DbConn = Knex | Knex.Transaction;
