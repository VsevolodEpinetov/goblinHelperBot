import 'dotenv/config';
// Register a CommonJS TS hook so knex's runtime `require()` of the .ts
// migration files works inside the vitest process (knex bypasses vitest's
// own transform). Scoped to integration tests, which are the only importers.
import 'tsx/cjs';

import knexLib from 'knex';
import type { Knex } from 'knex';

import knexConfig from '../../knexfile';
import { db as appDb } from '../../src/db/client';

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

interface MigratorProto {
  up: (config?: { name?: string }) => Promise<unknown>;
  list: () => Promise<[Array<string | { name: string }>, unknown[]]>;
  __upToPatched?: boolean;
}

/**
 * Make `migrate.up({ name })` apply every pending migration up to and
 * including `name`, which is what every migration test here expects.
 * Stock knex runs ONLY the single named migration, leaving its
 * prerequisites (the legacy chain) unapplied on a fresh test DB.
 * Patches the shared Migrator prototype; scoped to the vitest process.
 */
function patchMigrateUpTo(db: Knex): void {
  const proto = Object.getPrototypeOf(db.migrate) as MigratorProto;
  if (proto.__upToPatched) return;
  const originalUp = proto.up;
  proto.up = async function (this: MigratorProto, config?: { name?: string }) {
    if (!config?.name) return originalUp.call(this, config);
    for (;;) {
      const [completed, pending] = await this.list();
      const completedNames = completed.map((c) => (typeof c === 'string' ? c : c.name));
      if (completedNames.includes(config.name)) return;
      if (pending.length === 0) return originalUp.call(this, config);
      await originalUp.call(this);
    }
  };
  proto.__upToPatched = true;
}

/**
 * Create a fresh test database, return a knex instance pointed at it.
 * Caller must call `cleanup()` when done. Does NOT run migrations.
 */
export async function setupTestDb(): Promise<{
  db: Knex;
  cleanup: () => Promise<void>;
}> {
  // Suffix with the vitest worker id (unique per worker for the whole run,
  // across both thread and fork pools): test files run in parallel workers,
  // and each file drops/recreates its DB, so a shared name would have
  // workers killing each other's connections mid-test.
  const workerId = process.env.VITEST_WORKER_ID ?? String(process.pid);
  const testDbName = `${process.env.DB_TEST_NAME ?? 'goblin_test'}_w${workerId}`;
  const prodDbName = process.env.DB_NAME ?? '';
  if ((process.env.DB_TEST_NAME ?? 'goblin_test') === prodDbName) {
    throw new Error(
      `Refusing to use the production DB name "${prodDbName}" as the test DB. Set DB_TEST_NAME to something distinct.`,
    );
  }

  await appDb.destroy();

  const admin = adminConn();
  await admin.raw(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = ?`, [
    testDbName,
  ]);
  await admin.raw(`DROP DATABASE IF EXISTS "${testDbName}"`);
  await admin.raw(`CREATE DATABASE "${testDbName}"`);
  await admin.destroy();

  const testConfig = (knexConfig as Record<string, Knex.Config>).test!;
  const db = knexLib({
    ...testConfig,
    connection: { ...(testConfig.connection as Knex.PgConnectionConfig), database: testDbName },
  });
  patchMigrateUpTo(db);

  // Repoint the app's global singleton (src/db/client.ts) at this worker's DB:
  // services under test query through it rather than the handle we return.
  // Mutate in place — knex stores the password as a non-enumerable property,
  // so replacing the object would drop it.
  (
    appDb.client as unknown as { connectionSettings: { database?: string } }
  ).connectionSettings.database = testDbName;
  appDb.initialize();

  const cleanup = async (): Promise<void> => {
    await db.destroy();
    await appDb.destroy();
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
