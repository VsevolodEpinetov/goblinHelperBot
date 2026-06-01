import 'dotenv/config';
// Register a CommonJS TS hook so knex's runtime `require()` of the .ts
// migration files works inside the vitest process (knex bypasses vitest's
// own transform). Scoped to integration tests, which are the only importers.
import 'tsx/cjs';

import knexLib from 'knex';
import type { Knex } from 'knex';

import knexConfig from '../../knexfile';

function adminConn(): Knex {
  return knexLib({
    client: 'pg',
    connection: {
      host: process.env.DB_HOST ?? 'localhost',
      port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
      database: 'postgres',
      user: process.env.DB_USER ?? 'goblin',
      password: process.env.DB_PASSWORD ?? '',
    },
    pool: { min: 0, max: 1 },
  });
}

/**
 * Create a fresh test database, return a knex instance pointed at it.
 * Caller must call `cleanup()` when done. Does NOT run migrations.
 */
export async function setupTestDb(): Promise<{
  db: Knex;
  cleanup: () => Promise<void>;
}> {
  const testDbName = process.env.DB_TEST_NAME ?? 'goblin_test';
  const prodDbName = process.env.DB_NAME ?? '';
  if (testDbName === prodDbName) {
    throw new Error(
      `Refusing to use the production DB name "${prodDbName}" as the test DB. Set DB_TEST_NAME to something distinct.`,
    );
  }

  const admin = adminConn();
  await admin.raw(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = ?`, [
    testDbName,
  ]);
  await admin.raw(`DROP DATABASE IF EXISTS "${testDbName}"`);
  await admin.raw(`CREATE DATABASE "${testDbName}"`);
  await admin.destroy();

  const db = knexLib((knexConfig as Record<string, Knex.Config>).test!);

  const cleanup = async (): Promise<void> => {
    await db.destroy();
    const admin2 = adminConn();
    await admin2.raw(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = ?`, [
      testDbName,
    ]);
    await admin2.raw(`DROP DATABASE IF EXISTS "${testDbName}"`);
    await admin2.destroy();
  };

  return { db, cleanup };
}

/**
 * Run all migrations to latest. Convenience wrapper.
 */
export async function migrateAll(db: Knex): Promise<void> {
  await db.migrate.latest();
}
