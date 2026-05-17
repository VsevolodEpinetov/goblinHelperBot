import knexLib from 'knex';
import type { Knex } from 'knex';

/**
 * Real connection config is wired up in Plan 02 (data layer).
 * This stub exists so other modules can import the symbol without
 * triggering an actual connection during unit tests.
 */
export const db: Knex = knexLib({
  client: 'pg',
  connection: {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  },
  pool: { min: 0, max: 10 },
});

export type DbConn = Knex | Knex.Transaction;
