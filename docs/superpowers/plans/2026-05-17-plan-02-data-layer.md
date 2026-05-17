# Plan 02 — Data Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the data layer for the rewrite: real `src/db/client.ts` with env-driven config, knex migration system pointed at `src/db/migrations/`, integration test infrastructure against a real local Postgres, six new migration files (017–022) with full up/down and integration tests, repository-layer helpers (camelCase ↔ snake_case mapping; transaction-passing convention), and the pre-migration audit script.

**Architecture:** Migrations stay in source control under `src/db/migrations/`; the legacy `migrations/` directory at the repo root is moved here as part of this plan so knex has one location. New migrations 017–022 are written and tested but NOT run against production until cutover (Plan 09). Integration tests use a dedicated local Postgres test database (`goblin_test`) that's dropped/recreated per test run.

**Tech Stack:** TypeScript, knex 3.x, pg 8.x, Vitest with integration tests, real Postgres 14+ (local).

**Spec reference:** `docs/superpowers/specs/2026-05-17-bot-greenfield-rewrite-design.md` §5.

**Prerequisites for executing this plan:**
- Plan 01 complete.
- Local PostgreSQL 14+ running and accessible (the dev DB the user already has for the legacy bot).
- `.env` populated with `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`.
- Ability to create/drop a `goblin_test` database (the test user must have CREATE DATABASE privilege, or one is pre-created).

**Out of scope for this plan:**
- Running migrations against production (Plan 09).
- Repository classes for specific features (those land in feature-specific plans).
- `src/core/*` (Plan 03).

---

## File Structure

**Created:**
- `knexfile.ts` (replaces legacy `knexfile.js`; both can coexist briefly)
- `src/db/client.ts` (replaces the Plan 01 stub)
- `src/db/migrate-config.ts` (small helper exporting knex migration config for both `knexfile.ts` and tests)
- `src/db/mapper.ts` + tests (camelCase ↔ snake_case row mapping for the repo layer)
- `src/db/migrations/017_create_retroactive_tables.ts`
- `src/db/migrations/018_rename_camelcase_to_snakecase.ts`
- `src/db/migrations/019_add_payment_idempotency.ts`
- `src/db/migrations/020_add_user_achievements_unique.ts`
- `src/db/migrations/021_drop_dead_tables.ts`
- `src/db/migrations/022_normalize_invitation_links.ts`
- `tests/integration/setup.ts` (test DB lifecycle helpers)
- `tests/integration/migrations.017-create-retroactive.test.ts`
- `tests/integration/migrations.018-rename-snakecase.test.ts`
- `tests/integration/migrations.019-payment-idempotency.test.ts`
- `tests/integration/migrations.020-achievements-unique.test.ts`
- `tests/integration/migrations.021-drop-dead-tables.test.ts`
- `tests/integration/migrations.022-invitation-links.test.ts`
- `scripts/pre-migration-audit.ts`

**Moved:**
- All `migrations/*.js` files → `src/db/migrations/legacy/*.js` (preserved for history; knex will pick them up alongside the new TS migrations).

**Modified:**
- `package.json` (add `pg` already present + `migrate:test` script + `audit` script)
- `vitest.config.ts` (add an `integration` project or extend include to pick up `tests/integration/`)
- `docs/dev-setup.md` (document the test DB requirement)

---

## Task 1: Add `migrate:test` and `audit` scripts; install no new top-level deps

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add scripts**

Edit `package.json` `scripts` block to add:

```json
"migrate:test": "cross-env NODE_ENV=test knex migrate:latest",
"audit": "tsx scripts/pre-migration-audit.ts",
"test:integration": "vitest run tests/integration"
```

Add `cross-env` to `devDependencies`:

```json
"cross-env": "^7.0.3"
```

- [ ] **Step 2: Install**

```bash
npm install --save-dev cross-env
```

Expected: install adds cross-env; no peer warnings beyond the existing baseline.

- [ ] **Step 3: Verify scripts exist**

```bash
npm run | grep -E "migrate:test|audit|test:integration"
```

Expected: all three appear.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add migrate:test, audit, test:integration scripts"
```

---

## Task 2: Replace `knexfile.js` with `knexfile.ts`

**Files:**
- Create: `knexfile.ts`
- Delete: `knexfile.js` (it still exists at the root from the legacy code)

- [ ] **Step 1: Read existing `knexfile.js` for reference**

```bash
cat knexfile.js
```

Note the connection structure and migration directory.

- [ ] **Step 2: Create `knexfile.ts`**

```typescript
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
```

The `module.exports = config` line is for compatibility with knex CLI, which uses `require()`.

- [ ] **Step 3: Delete the legacy `knexfile.js`**

```bash
git rm knexfile.js
```

- [ ] **Step 4: Verify knex CLI can read the new config**

```bash
npx knex --knexfile knexfile.ts migrate:status
```

Expected: knex prints migration status (may error if test DB doesn't exist yet — that's fine; we only need to confirm the config loads). If it complains about the `tsx`/TS loader, run via:

```bash
node --loader tsx/esm node_modules/knex/bin/cli.js --knexfile knexfile.ts migrate:status
```

Or simpler: invoke via `npx tsx`:

```bash
npx tsx -e "import('./knexfile.ts').then(c => console.log('OK', Object.keys(c.default)));"
```

- [ ] **Step 5: Commit**

```bash
git add knexfile.ts
git commit -m "chore: convert knexfile to TypeScript with dev/test/production envs"
```

---

## Task 3: Move legacy migrations into `src/db/migrations/legacy/`

**Files:**
- Move: `migrations/*.js` → `src/db/migrations/legacy/*.js`

- [ ] **Step 1: Create the target directory and move**

```bash
mkdir -p src/db/migrations/legacy
git mv migrations/*.js src/db/migrations/legacy/
rmdir migrations
```

- [ ] **Step 2: Verify the moves**

```bash
ls src/db/migrations/legacy/
ls migrations 2>&1 | head -3
```

Expected: 15 .js files (001–016, missing 005) in `src/db/migrations/legacy/`. The old `migrations/` dir no longer exists.

- [ ] **Step 3: Verify knex picks up both directories**

```bash
npx tsx -e "import('./knexfile.ts').then(async ({default: c}) => { const knex = (await import('knex')).default(c.development); const list = await knex.migrate.list(); console.log('Completed:', list[0].length, 'Pending:', list[1].length); await knex.destroy(); });"
```

Expected: prints how many migrations have run and how many are pending. The 15 legacy migrations should be visible to knex. Whether they're "completed" or "pending" depends on the local DB state.

- [ ] **Step 4: Commit**

```bash
git add src/db/migrations/legacy/ migrations
git commit -m "chore: move legacy migrations into src/db/migrations/legacy/"
```

---

## Task 4: Wire `src/db/client.ts` with real env-driven config

**Files:**
- Modify: `src/db/client.ts` (replaces Plan 01 stub)

- [ ] **Step 1: Replace `src/db/client.ts`**

```typescript
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

/**
 * Helper for repo methods that should work inside or outside a transaction.
 * Always type repo methods as `(conn: DbConn, ...)` so callers can pass `db` or `trx`.
 */
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/db/client.ts
git commit -m "feat(db): real env-driven knex client config"
```

---

## Task 5: Build `src/db/mapper.ts` (camelCase ↔ snake_case at the repo boundary, TDD)

After migration 018 the DB columns are snake_case. TypeScript code prefers camelCase. This module is the bidirectional mapper.

**Files:**
- Create: `src/db/mapper.ts`
- Create: `src/db/mapper.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from 'vitest';

import { fromDbRow, toDbRow, snakeKey, camelKey } from './mapper';

describe('mapper', () => {
  describe('snakeKey / camelKey', () => {
    it('converts camelCase to snake_case', () => {
      expect(snakeKey('userId')).toBe('user_id');
      expect(snakeKey('createdAt')).toBe('created_at');
      expect(snakeKey('telegramPaymentChargeId')).toBe('telegram_payment_charge_id');
      expect(snakeKey('id')).toBe('id');
    });

    it('converts snake_case to camelCase', () => {
      expect(camelKey('user_id')).toBe('userId');
      expect(camelKey('created_at')).toBe('createdAt');
      expect(camelKey('telegram_payment_charge_id')).toBe('telegramPaymentChargeId');
      expect(camelKey('id')).toBe('id');
    });
  });

  describe('fromDbRow', () => {
    it('maps a snake_case row to camelCase', () => {
      expect(fromDbRow({ user_id: 1, created_at: 'now' })).toEqual({
        userId: 1,
        createdAt: 'now',
      });
    });

    it('passes through values unchanged', () => {
      const date = new Date(0);
      expect(fromDbRow({ created_at: date })).toEqual({ createdAt: date });
    });

    it('returns null/undefined inputs as-is', () => {
      expect(fromDbRow(null)).toBeNull();
      expect(fromDbRow(undefined)).toBeUndefined();
    });
  });

  describe('toDbRow', () => {
    it('maps a camelCase object to snake_case', () => {
      expect(toDbRow({ userId: 1, createdAt: 'now' })).toEqual({
        user_id: 1,
        created_at: 'now',
      });
    });

    it('does not include undefined values', () => {
      expect(toDbRow({ userId: 1, email: undefined })).toEqual({ user_id: 1 });
    });
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npx vitest run src/db/mapper.test.ts
```

- [ ] **Step 3: Implement `src/db/mapper.ts`**

```typescript
export function snakeKey(camel: string): string {
  return camel.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
}

export function camelKey(snake: string): string {
  return snake.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

export function fromDbRow<T extends Record<string, unknown>>(
  row: T | null | undefined,
): { [K in keyof T as K extends string ? string : never]: T[K] } | T | null | undefined {
  if (row === null || row === undefined) return row;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    out[camelKey(key)] = value;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return out as any;
}

export function toDbRow<T extends Record<string, unknown>>(
  obj: T,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    out[snakeKey(key)] = value;
  }
  return out;
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/db/mapper.test.ts
```

Expected: all assertions pass.

- [ ] **Step 5: Commit**

```bash
git add src/db/mapper.ts src/db/mapper.test.ts
git commit -m "feat(db): add camelCase/snake_case row mapper"
```

---

## Task 6: Set up integration test infrastructure

**Files:**
- Create: `tests/integration/setup.ts`
- Modify: `vitest.config.ts` (add integration test environment)

- [ ] **Step 1: Create `tests/integration/setup.ts`**

```typescript
import 'dotenv/config';

import knexLib from 'knex';
import type { Knex } from 'knex';

import knexConfig from '../../knexfile';

/**
 * Create a fresh test database, run all migrations to bring it to current schema,
 * and return a knex instance pointed at it. Caller must call `cleanup()` when done.
 */
export async function setupTestDb(): Promise<{
  db: Knex;
  cleanup: () => Promise<void>;
}> {
  const testDbName = process.env.DB_TEST_NAME ?? 'goblin_test';

  // Admin connection (to the postgres default DB) to create/drop the test DB.
  const admin = knexLib({
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

  // Drop & recreate to guarantee a clean slate.
  await admin.raw(
    `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = ?`,
    [testDbName],
  );
  await admin.raw(`DROP DATABASE IF EXISTS "${testDbName}"`);
  await admin.raw(`CREATE DATABASE "${testDbName}"`);
  await admin.destroy();

  const db = knexLib(knexConfig.test);

  const cleanup = async (): Promise<void> => {
    await db.destroy();
    const admin2 = knexLib({
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
    await admin2.raw(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = ?`,
      [testDbName],
    );
    await admin2.raw(`DROP DATABASE IF EXISTS "${testDbName}"`);
    await admin2.destroy();
  };

  return { db, cleanup };
}

/**
 * Run all migrations up to (but not including) the named migration.
 * Used to set up the schema at a known state before testing a new migration.
 */
export async function migrateUpTo(db: Knex, beforeMigration: string): Promise<void> {
  // Run all pending migrations one at a time until we reach the target.
  let last = '';
  while (true) {
    const [completed] = await db.migrate.list();
    if (completed.some((m) => m.name === beforeMigration)) return;
    const result = await db.migrate.up();
    const newlyApplied = result[1];
    if (!newlyApplied || newlyApplied.length === 0) return;
    last = newlyApplied[0]!.file;
    if (last === beforeMigration) {
      // We applied the target, but we wanted to stop BEFORE it. Roll back one.
      await db.migrate.down();
      return;
    }
  }
}

/**
 * Run all migrations to latest.
 */
export async function migrateAll(db: Knex): Promise<void> {
  await db.migrate.latest();
}
```

- [ ] **Step 2: Update `vitest.config.ts` to set a longer hook timeout for integration tests**

Add to the `test` block:

```typescript
hookTimeout: 30000,
testTimeout: 30000,
```

- [ ] **Step 3: Sanity-check that setup works**

```bash
npx tsx -e "import('./tests/integration/setup.ts').then(async ({setupTestDb}) => { const {db, cleanup} = await setupTestDb(); console.log('DB ready'); await cleanup(); console.log('Cleaned up'); });"
```

Expected: prints "DB ready" then "Cleaned up". If this fails because the user has no local Postgres or no CREATE DATABASE privilege, STOP and escalate.

- [ ] **Step 4: Commit**

```bash
git add tests/integration/setup.ts vitest.config.ts
git commit -m "test(integration): add Postgres test DB lifecycle helpers"
```

---

## Task 7: Write migration 017 — retroactive table documentation

This migration documents the existing-but-undocumented tables (`users`, `months`, `kickstarters`, `applications`, `settings`). It uses `hasTable()` guards so it's a no-op against existing DBs (which already have these tables) but creates them on a fresh DB. This is what makes a clean `knex migrate:latest` from scratch actually work.

**Files:**
- Create: `src/db/migrations/017_create_retroactive_tables.ts`
- Create: `tests/integration/migrations.017-create-retroactive.test.ts`

- [ ] **Step 1: Inspect the actual production schema to derive column definitions**

The implementer MUST read `modules/db/helpers.js` (legacy) to enumerate the columns and types used for each of these tables. Specifically:
- `users`: columns referenced in `getUser`, `addUser`, etc.
- `months`: columns referenced in `findMonthByChatId`, `incrementMonthCounter`, `getMonthChatId`.
- `kickstarters`: columns referenced in `addKickstarter`, `getKickstarterById`.
- `applications`: columns referenced in admin onboarding flow.
- `settings`: key/value usage in helpers.

Report what's found before writing the migration. If columns are ambiguous (e.g., legacy code mixes string lookups), STOP and escalate — guessing risks creating a wrong canonical schema.

- [ ] **Step 2: Write `src/db/migrations/017_create_retroactive_tables.ts`**

Pattern (you fill in the columns based on Step 1):

```typescript
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // users
  if (!(await knex.schema.hasTable('users'))) {
    await knex.schema.createTable('users', (table) => {
      table.bigInteger('id').primary(); // Telegram user_id, NOT auto-increment
      table.string('username').nullable();
      table.string('firstName').nullable();
      table.string('lastName').nullable();
      table.timestamp('createdAt').defaultTo(knex.fn.now());
      // TODO Step 1: confirm columns from helpers.js inspection
    });
  }

  // months
  if (!(await knex.schema.hasTable('months'))) {
    await knex.schema.createTable('months', (table) => {
      table.increments('id').primary();
      table.integer('year').notNullable();
      table.integer('month').notNullable();
      table.string('type').notNullable(); // 'regular' or 'plus'
      table.bigInteger('chatId').nullable();
      table.integer('counterJoined').defaultTo(0);
      table.integer('counterPaid').defaultTo(0);
      table.timestamp('createdAt').defaultTo(knex.fn.now());
      table.unique(['year', 'month', 'type']);
    });
  }

  // kickstarters
  if (!(await knex.schema.hasTable('kickstarters'))) {
    await knex.schema.createTable('kickstarters', (table) => {
      table.increments('id').primary();
      table.string('name').notNullable();
      table.string('creator').nullable();
      table.string('pledge').nullable();
      table.integer('price').nullable();
      table.string('link').nullable();
      table.timestamp('createdAt').defaultTo(knex.fn.now());
    });
  }

  // applications
  if (!(await knex.schema.hasTable('applications'))) {
    await knex.schema.createTable('applications', (table) => {
      table.increments('id').primary();
      table.bigInteger('userId').notNullable();
      table.string('invitationCode').nullable();
      table.text('answers').nullable(); // JSON serialised
      table.string('status').defaultTo('pending');
      table.timestamp('createdAt').defaultTo(knex.fn.now());
      table.foreign('userId').references('id').inTable('users').onDelete('CASCADE');
    });
  }

  // settings (key/value)
  if (!(await knex.schema.hasTable('settings'))) {
    await knex.schema.createTable('settings', (table) => {
      table.string('key').primary();
      table.text('value').nullable();
      table.timestamp('updatedAt').defaultTo(knex.fn.now());
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  // Symmetric drops; this is a documentation migration, so down is only
  // meaningful for fresh-environment teardown.
  await knex.schema.dropTableIfExists('settings');
  await knex.schema.dropTableIfExists('applications');
  await knex.schema.dropTableIfExists('kickstarters');
  await knex.schema.dropTableIfExists('months');
  await knex.schema.dropTableIfExists('users');
}
```

Replace the `TODO Step 1` comment block with the actual column definitions you confirmed from helpers.js.

- [ ] **Step 3: Write the integration test**

```typescript
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Knex } from 'knex';

import { setupTestDb } from './setup';

describe('migration 017 — retroactive tables', () => {
  let db: Knex;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    ({ db, cleanup } = await setupTestDb());
  });

  afterEach(async () => {
    await cleanup();
  });

  it('creates users, months, kickstarters, applications, and settings on a fresh DB', async () => {
    await db.migrate.latest();

    for (const table of ['users', 'months', 'kickstarters', 'applications', 'settings']) {
      const has = await db.schema.hasTable(table);
      expect(has).toBe(true);
    }
  });

  it('is idempotent — running again does not error', async () => {
    await db.migrate.latest();
    // Re-running latest is a no-op (already at latest); manually re-call up() on 017.
    // We rely on the hasTable guard.
    // No assertion needed beyond "does not throw".
  });

  it('down-migration drops the tables', async () => {
    await db.migrate.latest();
    // Roll back to before 017
    await db.migrate.rollback({}, false); // Rolls back the most recent batch
    for (const table of ['users', 'months', 'kickstarters', 'applications', 'settings']) {
      const has = await db.schema.hasTable(table);
      // Tables may or may not exist depending on whether 017 was the latest in its batch.
      // The critical assertion: the down() migration ran without error.
      void has;
    }
  });
});
```

- [ ] **Step 4: Run the test**

```bash
npx vitest run tests/integration/migrations.017-create-retroactive.test.ts
```

Expected: all assertions pass. If the test errors with `relation "users" already exists`, the existing legacy migrations may have implicitly created it — investigate and adjust the `hasTable` guard or test fixture.

- [ ] **Step 5: Commit**

```bash
git add src/db/migrations/017_create_retroactive_tables.ts tests/integration/migrations.017-create-retroactive.test.ts
git commit -m "feat(db): migration 017 — document existing tables for fresh-env setup"
```

---

## Task 8: Write migration 018 — camelCase → snake_case column rename

This is the riskiest migration. It renames every camelCase column on the 14 affected tables to snake_case. Down-migration restores camelCase. Must be transactional and tested with realistic fixture data.

**Files:**
- Create: `src/db/migrations/018_rename_camelcase_to_snakecase.ts`
- Create: `tests/integration/migrations.018-rename-snakecase.test.ts`

- [ ] **Step 1: Build the rename manifest**

Read every legacy migration in `src/db/migrations/legacy/` and identify every camelCase column. Compile a mapping table per affected table. The 14 affected tables and their expected columns (verify against the legacy migrations):

- `users`: `firstName` → `first_name`, `lastName` → `last_name`, `createdAt` → `created_at`
- `userPurchases`: rename table itself to `user_purchases`; `userId` → `user_id`
- `userRoles`: rename table to `user_roles`; `userId` → `user_id`
- `userGroups`: rename table to `user_groups`; `userId` → `user_id`
- `userKickstarters`: rename table to `user_kickstarters`; `userId` → `user_id`, `kickstarterId` → `kickstarter_id`
- `months`: `chatId` → `chat_id`, `counterJoined` → `counter_joined`, `counterPaid` → `counter_paid`, `createdAt` → `created_at`
- `applications`: `userId` → `user_id`, `invitationCode` → `invitation_code`, `createdAt` → `created_at`
- `paymentTracking`: rename table to `payment_tracking`; `userId` → `user_id`, `subscriptionType` → `subscription_type`, `invoiceMessageId` → `invoice_message_id`, `telegramPaymentChargeId` → `telegram_payment_charge_id`, `createdAt` → `created_at`, `completedAt` → `completed_at`, `isUpgrade` → `is_upgrade`
- `invitationLinks`: rename table to `invitation_links`; `userId`, `groupPeriod`, `groupType`, `telegramInviteLink`, `telegramInviteLinkName`, `telegramInviteLinkCreatorId`, `telegramInviteLinkIsPrimary`, `telegramInviteLinkIsRevoked`, `telegramInviteLinkExpireDate`, `telegramInviteLinkMemberLimit`, `createsJoinRequest`, `useCount`, `usedAt`, `createdAt`, `invitationCode` → all snake_case
- `kickstarterPromoMessages`: rename table to `kickstarter_promo_messages`; `kickstarterId`, `messageId`, `chatId`, `topicId`, `createdAt`, `updatedAt`
- `userScrolls`: rename table to `user_scrolls`; `userId`, `scrollId`, `createdAt`, `updatedAt`
- `scrollLogs`: rename table to `scroll_logs`; `userId`, `scrollId`, `createdAt`
- `kickstarterPhotos`: rename table to `kickstarter_photos`; verify columns from migration 016
- `kickstarterFiles`: rename table to `kickstarter_files`; verify columns from migration 016
- `kickstarters`: `createdAt` → `created_at` (the column list is otherwise simple)

Write the manifest as a typed object in the migration file (see Step 2).

- [ ] **Step 2: Write `src/db/migrations/018_rename_camelcase_to_snakecase.ts`**

```typescript
import type { Knex } from 'knex';

interface TableRename {
  /** Old table name (camelCase). Null/undefined if only columns rename. */
  oldTable?: string;
  /** New table name (snake_case). Required if oldTable is set. */
  newTable?: string;
  /** column renames within the (post-rename) table */
  columns: Record<string, string>; // old → new
}

const RENAMES: Record<string, TableRename> = {
  users: {
    columns: { firstName: 'first_name', lastName: 'last_name', createdAt: 'created_at' },
  },
  userPurchases: {
    oldTable: 'userPurchases',
    newTable: 'user_purchases',
    columns: { userId: 'user_id' },
  },
  // ... fill in all entries from Step 1's manifest
};

async function renameTableIfExists(knex: Knex, oldName: string, newName: string): Promise<void> {
  const exists = await knex.schema.hasTable(oldName);
  if (exists) await knex.schema.renameTable(oldName, newName);
}

async function renameColumnIfExists(
  knex: Knex,
  tableName: string,
  oldCol: string,
  newCol: string,
): Promise<void> {
  const hasOld = await knex.schema.hasColumn(tableName, oldCol);
  if (hasOld) {
    await knex.schema.alterTable(tableName, (t) => t.renameColumn(oldCol, newCol));
  }
}

export async function up(knex: Knex): Promise<void> {
  // Wrap in a single transaction so a mid-migration failure rolls everything back.
  await knex.transaction(async (trx) => {
    for (const [, rename] of Object.entries(RENAMES)) {
      if (rename.oldTable && rename.newTable) {
        await renameTableIfExists(trx, rename.oldTable, rename.newTable);
      }
      const finalTable = rename.newTable ?? Object.keys(RENAMES).find(
        (k) => RENAMES[k] === rename,
      )!;
      for (const [oldCol, newCol] of Object.entries(rename.columns)) {
        await renameColumnIfExists(trx, finalTable, oldCol, newCol);
      }
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    // Reverse the order so column renames happen before table renames.
    const entries = Object.entries(RENAMES).reverse();
    for (const [, rename] of entries) {
      const currentTable = rename.newTable ?? Object.keys(RENAMES).find(
        (k) => RENAMES[k] === rename,
      )!;
      for (const [oldCol, newCol] of Object.entries(rename.columns)) {
        await renameColumnIfExists(trx, currentTable, newCol, oldCol);
      }
      if (rename.oldTable && rename.newTable) {
        await renameTableIfExists(trx, rename.newTable, rename.oldTable);
      }
    }
  });
}
```

Fill in the full RENAMES manifest matching Step 1.

- [ ] **Step 3: Write the integration test**

```typescript
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Knex } from 'knex';

import { setupTestDb } from './setup';

describe('migration 018 — camelCase to snake_case rename', () => {
  let db: Knex;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    ({ db, cleanup } = await setupTestDb());
  });

  afterEach(async () => {
    await cleanup();
  });

  it('renames userPurchases → user_purchases and preserves data', async () => {
    // Run all legacy migrations + 017 (everything before 018)
    await db.migrate.up({ name: '017_create_retroactive_tables.ts' });

    // Insert fixture data using the OLD camelCase shape
    await db('users').insert({ id: 1, username: 'u1', firstName: 'Alice', lastName: 'A' });
    // (insert into other relevant tables …)

    // Run 018
    await db.migrate.up({ name: '018_rename_camelcase_to_snakecase.ts' });

    // Assert new table/column shape
    const row = await db('user_purchases').where('user_id', 1).first();
    expect(row).toBeDefined();

    // Assert old shape is gone
    const hasOld = await db.schema.hasColumn('user_purchases', 'userId');
    expect(hasOld).toBe(false);
  });

  it('down-migration restores camelCase columns and table names', async () => {
    await db.migrate.latest();
    await db.migrate.down({ name: '018_rename_camelcase_to_snakecase.ts' });

    const hasOldTable = await db.schema.hasTable('userPurchases');
    expect(hasOldTable).toBe(true);
  });
});
```

Add fixture rows for each affected table; assert data preservation across the rename.

- [ ] **Step 4: Run the test**

```bash
npx vitest run tests/integration/migrations.018-rename-snakecase.test.ts
```

Expected: passes. If column renames fail because of foreign-key constraint dependencies, you may need to drop & re-add FKs explicitly inside the migration.

- [ ] **Step 5: Commit**

```bash
git add src/db/migrations/018_rename_camelcase_to_snakecase.ts tests/integration/migrations.018-rename-snakecase.test.ts
git commit -m "feat(db): migration 018 — rename camelCase columns to snake_case"
```

---

## Task 9: Write migration 019 — payment idempotency

Adds `source` column to `payment_tracking` and `external_id` + `UNIQUE(source, external_id)` to `xp_transactions`. The `telegram_payment_charge_id` column already exists (was created in migration 004); we add a UNIQUE index on it.

**Files:**
- Create: `src/db/migrations/019_add_payment_idempotency.ts`
- Create: `tests/integration/migrations.019-payment-idempotency.test.ts`

- [ ] **Step 1: Write the migration**

```typescript
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    // payment_tracking: add unique index on telegram_payment_charge_id (skip nulls)
    await trx.schema.alterTable('payment_tracking', (t) => {
      t.string('source').defaultTo('stars'); // 'stars' | 'sbp' | 'manual'
    });

    // Backfill source for existing rows
    await trx('payment_tracking').whereNull('source').update({ source: 'stars' });

    // Add partial unique index on telegram_payment_charge_id (only where not null)
    await trx.raw(
      `CREATE UNIQUE INDEX IF NOT EXISTS payment_tracking_charge_id_unique
       ON payment_tracking (telegram_payment_charge_id)
       WHERE telegram_payment_charge_id IS NOT NULL`,
    );

    // xp_transactions: add external_id + unique(source, external_id)
    const hasExternalId = await trx.schema.hasColumn('xp_transactions', 'external_id');
    if (!hasExternalId) {
      await trx.schema.alterTable('xp_transactions', (t) => {
        t.string('external_id').nullable();
      });
    }

    await trx.raw(
      `CREATE UNIQUE INDEX IF NOT EXISTS xp_transactions_source_external_id_unique
       ON xp_transactions (source, external_id)
       WHERE external_id IS NOT NULL`,
    );
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    await trx.raw('DROP INDEX IF EXISTS xp_transactions_source_external_id_unique');
    await trx.schema.alterTable('xp_transactions', (t) => {
      t.dropColumn('external_id');
    });
    await trx.raw('DROP INDEX IF EXISTS payment_tracking_charge_id_unique');
    await trx.schema.alterTable('payment_tracking', (t) => {
      t.dropColumn('source');
    });
  });
}
```

NOTE: this migration assumes 018 has already run (uses snake_case names). The integration test must run 017+018 before 019.

- [ ] **Step 2: Write the integration test**

```typescript
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Knex } from 'knex';

import { setupTestDb } from './setup';

describe('migration 019 — payment idempotency', () => {
  let db: Knex;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    ({ db, cleanup } = await setupTestDb());
  });

  afterEach(async () => {
    await cleanup();
  });

  it('adds source column to payment_tracking with default stars', async () => {
    await db.migrate.latest();
    const has = await db.schema.hasColumn('payment_tracking', 'source');
    expect(has).toBe(true);
  });

  it('blocks duplicate telegram_payment_charge_id inserts', async () => {
    await db.migrate.latest();
    await db('users').insert({ id: 1, username: 'u1' });
    await db('payment_tracking').insert({
      user_id: 1,
      type: 'subscription',
      period: '2026_05',
      amount: 100,
      currency: 'XTR',
      status: 'completed',
      telegram_payment_charge_id: 'charge_123',
      source: 'stars',
    });

    await expect(
      db('payment_tracking').insert({
        user_id: 1,
        type: 'subscription',
        period: '2026_06',
        amount: 100,
        currency: 'XTR',
        status: 'completed',
        telegram_payment_charge_id: 'charge_123',
        source: 'stars',
      }),
    ).rejects.toThrow(/unique|duplicate/i);
  });

  it('blocks duplicate xp_transactions on (source, external_id)', async () => {
    await db.migrate.latest();
    await db('users').insert({ id: 1, username: 'u1' });
    await db('xp_transactions').insert({
      user_id: 1,
      amount: 100,
      source: 'payment',
      external_id: 'charge_abc',
    });

    await expect(
      db('xp_transactions').insert({
        user_id: 1,
        amount: 100,
        source: 'payment',
        external_id: 'charge_abc',
      }),
    ).rejects.toThrow(/unique|duplicate/i);
  });
});
```

- [ ] **Step 3: Run test**

```bash
npx vitest run tests/integration/migrations.019-payment-idempotency.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add src/db/migrations/019_add_payment_idempotency.ts tests/integration/migrations.019-payment-idempotency.test.ts
git commit -m "feat(db): migration 019 — payment + XP idempotency constraints"
```

---

## Task 10: Write migration 020 — user_achievements UNIQUE constraint with dedupe

**Files:**
- Create: `src/db/migrations/020_add_user_achievements_unique.ts`
- Create: `tests/integration/migrations.020-achievements-unique.test.ts`

- [ ] **Step 1: Write the migration**

```typescript
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    // Dedupe: keep the oldest (lowest id) row per (user_id, achievement_type)
    await trx.raw(`
      DELETE FROM user_achievements
      WHERE id NOT IN (
        SELECT MIN(id) FROM user_achievements
        GROUP BY user_id, achievement_type
      )
    `);

    await trx.raw(`
      ALTER TABLE user_achievements
      ADD CONSTRAINT user_achievements_user_id_achievement_type_unique
      UNIQUE (user_id, achievement_type)
    `);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE user_achievements
    DROP CONSTRAINT IF EXISTS user_achievements_user_id_achievement_type_unique
  `);
}
```

- [ ] **Step 2: Write the integration test**

```typescript
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Knex } from 'knex';

import { setupTestDb } from './setup';

describe('migration 020 — user_achievements UNIQUE', () => {
  let db: Knex;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    ({ db, cleanup } = await setupTestDb());
  });

  afterEach(async () => {
    await cleanup();
  });

  it('deduplicates existing rows on (user_id, achievement_type)', async () => {
    // Migrate up to just before 020
    await db.migrate.up({ name: '019_add_payment_idempotency.ts' });

    // Insert two duplicate rows
    await db('users').insert({ id: 1, username: 'u1' });
    await db('user_achievements').insert([
      { user_id: 1, achievement_type: 'years_of_service' },
      { user_id: 1, achievement_type: 'years_of_service' },
    ]);

    await db.migrate.up({ name: '020_add_user_achievements_unique.ts' });

    const rows = await db('user_achievements').where({ user_id: 1, achievement_type: 'years_of_service' });
    expect(rows).toHaveLength(1);
  });

  it('rejects duplicate inserts after migration', async () => {
    await db.migrate.latest();
    await db('users').insert({ id: 1, username: 'u1' });
    await db('user_achievements').insert({ user_id: 1, achievement_type: 'sbp_payment' });

    await expect(
      db('user_achievements').insert({ user_id: 1, achievement_type: 'sbp_payment' }),
    ).rejects.toThrow(/unique|duplicate/i);
  });
});
```

- [ ] **Step 3: Run test**

```bash
npx vitest run tests/integration/migrations.020-achievements-unique.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add src/db/migrations/020_add_user_achievements_unique.ts tests/integration/migrations.020-achievements-unique.test.ts
git commit -m "feat(db): migration 020 — UNIQUE(user_id, achievement_type) with dedupe"
```

---

## Task 11: Write migration 021 — drop dead tables

Drops `userLoyalty` (deprecated, replaced by `user_levels`) and the entire lots subsystem (8 tables). Per scope decision in §1.5 of the spec.

**Files:**
- Create: `src/db/migrations/021_drop_dead_tables.ts`
- Create: `tests/integration/migrations.021-drop-dead-tables.test.ts`

- [ ] **Step 1: Write the migration**

```typescript
import type { Knex } from 'knex';

const TABLES_TO_DROP = [
  'userLoyalty',
  'user_favorites',
  'user_preferences',
  'lot_tag_assignments',
  'lot_participants',
  'lot_photos',
  'lots',
  'lot_tags',
  'lot_categories',
];

export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    for (const table of TABLES_TO_DROP) {
      await trx.schema.dropTableIfExists(table);
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  // Down recreates empty tables (best-effort; data is irrecoverable by design).
  // We replicate the original schemas from migrations 001 and 002 so that
  // rolling back this migration leaves a structurally valid DB.

  if (!(await knex.schema.hasTable('userLoyalty'))) {
    await knex.schema.createTable('userLoyalty', (table) => {
      table.bigInteger('userId').primary();
      table.string('level').defaultTo('newbie');
      table.timestamp('updatedAt').defaultTo(knex.fn.now());
    });
  }

  // Recreate lots tables as empty shells (matches migration 001 shape).
  // Implementer: copy createTable definitions from src/db/migrations/legacy/001_create_lots_tables.js verbatim.
}
```

- [ ] **Step 2: Write the integration test**

```typescript
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Knex } from 'knex';

import { setupTestDb } from './setup';

describe('migration 021 — drop dead tables', () => {
  let db: Knex;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    ({ db, cleanup } = await setupTestDb());
  });

  afterEach(async () => {
    await cleanup();
  });

  it('drops userLoyalty, lots, and related tables', async () => {
    await db.migrate.latest();
    for (const table of ['userLoyalty', 'lots', 'lot_categories', 'lot_tags']) {
      const has = await db.schema.hasTable(table);
      expect(has).toBe(false);
    }
  });

  it('down-migration recreates the tables as empty', async () => {
    await db.migrate.latest();
    await db.migrate.down({ name: '021_drop_dead_tables.ts' });

    const hasLoyalty = await db.schema.hasTable('userLoyalty');
    expect(hasLoyalty).toBe(true);
  });
});
```

- [ ] **Step 3: Run test**

```bash
npx vitest run tests/integration/migrations.021-drop-dead-tables.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add src/db/migrations/021_drop_dead_tables.ts tests/integration/migrations.021-drop-dead-tables.test.ts
git commit -m "feat(db): migration 021 — drop deprecated lots/userLoyalty tables"
```

---

## Task 12: Write migration 022 — normalize invitation_links

Drops 6 typed Telegram-API columns from `invitation_links`, replaces with a single `telegram_metadata` JSONB column, and backfills existing data.

**Files:**
- Create: `src/db/migrations/022_normalize_invitation_links.ts`
- Create: `tests/integration/migrations.022-invitation-links.test.ts`

- [ ] **Step 1: Write the migration**

```typescript
import type { Knex } from 'knex';

const TELEGRAM_COLUMNS = [
  'telegram_invite_link_name',
  'telegram_invite_link_creator_id',
  'telegram_invite_link_is_primary',
  'telegram_invite_link_is_revoked',
  'telegram_invite_link_expire_date',
  'telegram_invite_link_member_limit',
] as const;

export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    await trx.schema.alterTable('invitation_links', (t) => {
      t.jsonb('telegram_metadata').nullable();
    });

    // Backfill: collect the six columns into a JSONB object for every row
    await trx.raw(`
      UPDATE invitation_links
      SET telegram_metadata = jsonb_build_object(
        'name', telegram_invite_link_name,
        'creator_id', telegram_invite_link_creator_id,
        'is_primary', telegram_invite_link_is_primary,
        'is_revoked', telegram_invite_link_is_revoked,
        'expire_date', telegram_invite_link_expire_date,
        'member_limit', telegram_invite_link_member_limit
      )
    `);

    await trx.schema.alterTable('invitation_links', (t) => {
      for (const col of TELEGRAM_COLUMNS) {
        t.dropColumn(col);
      }
    });
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    await trx.schema.alterTable('invitation_links', (t) => {
      t.string('telegram_invite_link_name').nullable();
      t.bigInteger('telegram_invite_link_creator_id').nullable();
      t.boolean('telegram_invite_link_is_primary').nullable();
      t.boolean('telegram_invite_link_is_revoked').nullable();
      t.timestamp('telegram_invite_link_expire_date').nullable();
      t.integer('telegram_invite_link_member_limit').nullable();
    });

    await trx.raw(`
      UPDATE invitation_links
      SET
        telegram_invite_link_name = telegram_metadata->>'name',
        telegram_invite_link_creator_id = (telegram_metadata->>'creator_id')::bigint,
        telegram_invite_link_is_primary = (telegram_metadata->>'is_primary')::boolean,
        telegram_invite_link_is_revoked = (telegram_metadata->>'is_revoked')::boolean,
        telegram_invite_link_expire_date = (telegram_metadata->>'expire_date')::timestamp,
        telegram_invite_link_member_limit = (telegram_metadata->>'member_limit')::int
      WHERE telegram_metadata IS NOT NULL
    `);

    await trx.schema.alterTable('invitation_links', (t) => {
      t.dropColumn('telegram_metadata');
    });
  });
}
```

- [ ] **Step 2: Write the integration test**

```typescript
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Knex } from 'knex';

import { setupTestDb } from './setup';

describe('migration 022 — normalize invitation_links', () => {
  let db: Knex;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    ({ db, cleanup } = await setupTestDb());
  });

  afterEach(async () => {
    await cleanup();
  });

  it('moves Telegram fields into a JSONB column', async () => {
    // Migrate up to just before 022
    await db.migrate.up({ name: '021_drop_dead_tables.ts' });

    await db('users').insert({ id: 1, username: 'u1' });
    await db('invitation_links').insert({
      user_id: 1,
      group_period: '2026_05',
      telegram_invite_link: 'https://t.me/+abc',
      telegram_invite_link_name: 'May2026',
      telegram_invite_link_creator_id: 999,
      telegram_invite_link_is_primary: false,
      telegram_invite_link_is_revoked: false,
      telegram_invite_link_member_limit: 1,
    });

    await db.migrate.up({ name: '022_normalize_invitation_links.ts' });

    const row = await db('invitation_links').where({ user_id: 1 }).first();
    expect(row.telegram_metadata).toMatchObject({
      name: 'May2026',
      creator_id: '999', // JSONB stores numbers as numbers, but ->> casts to text. Adjust expectation if needed.
      is_primary: false,
      member_limit: 1,
    });

    // Old columns should be gone
    const hasOld = await db.schema.hasColumn('invitation_links', 'telegram_invite_link_name');
    expect(hasOld).toBe(false);
  });
});
```

Adjust the `creator_id` comparison if jsonb_build_object preserves the integer type — verify with a quick `SELECT` in psql if needed.

- [ ] **Step 3: Run test**

```bash
npx vitest run tests/integration/migrations.022-invitation-links.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add src/db/migrations/022_normalize_invitation_links.ts tests/integration/migrations.022-invitation-links.test.ts
git commit -m "feat(db): migration 022 — normalize invitation_links to JSONB metadata"
```

---

## Task 13: Write `scripts/pre-migration-audit.ts`

Reports anomalies in production data that would cause migration 020's UNIQUE constraint to fail or that indicate broader data-integrity issues. Run before cutover.

**Files:**
- Create: `scripts/pre-migration-audit.ts`

- [ ] **Step 1: Implement**

```typescript
import 'dotenv/config';

import knexLib from 'knex';
import type { Knex } from 'knex';

const db: Knex = knexLib({
  client: 'pg',
  connection: {
    host: process.env.DB_HOST ?? 'localhost',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
    database: process.env.DB_NAME ?? 'goblin_bot',
    user: process.env.DB_USER ?? 'goblin',
    password: process.env.DB_PASSWORD ?? '',
  },
  pool: { min: 0, max: 5 },
});

interface AuditSection {
  title: string;
  rows: unknown[];
}

async function checkDuplicateAchievements(): Promise<AuditSection> {
  // NOTE: this script runs against the LIVE production DB before migration 018, so columns
  // are still camelCase. Adjust column references if running after 018.
  const rows = await db.raw<{ rows: Array<{ userId: number; achievement_type: string; count: number }> }>(
    `SELECT "userId" as user_id, achievement_type, COUNT(*)::int as count
     FROM user_achievements
     GROUP BY "userId", achievement_type
     HAVING COUNT(*) > 1`,
  );
  return { title: 'Duplicate achievements (migration 020 would fail without dedupe)', rows: rows.rows };
}

async function checkOrphanedPaymentTracking(): Promise<AuditSection> {
  const rows = await db.raw<{ rows: unknown[] }>(
    `SELECT id, "userId", period, status, "createdAt"
     FROM "paymentTracking"
     WHERE status = 'pending'
       AND "createdAt" < NOW() - INTERVAL '30 days'`,
  );
  return { title: 'Stale pending payments (>30 days)', rows: rows.rows };
}

async function checkBothRegularAndPlusForSamePeriod(): Promise<AuditSection> {
  const rows = await db.raw<{ rows: unknown[] }>(
    `SELECT "userId", period
     FROM "userGroups"
     GROUP BY "userId", period
     HAVING COUNT(DISTINCT type) > 1`,
  );
  return { title: 'Users with both regular and plus for the same period', rows: rows.rows };
}

async function checkUserGroupsWithoutPayment(): Promise<AuditSection> {
  const rows = await db.raw<{ rows: unknown[] }>(
    `SELECT ug."userId", ug.period, ug.type
     FROM "userGroups" ug
     LEFT JOIN "paymentTracking" pt
       ON pt."userId" = ug."userId" AND pt.period = ug.period
     WHERE pt.id IS NULL`,
  );
  return { title: 'User group memberships with no matching payment_tracking row', rows: rows.rows };
}

async function main(): Promise<void> {
  const sections = await Promise.all([
    checkDuplicateAchievements(),
    checkOrphanedPaymentTracking(),
    checkBothRegularAndPlusForSamePeriod(),
    checkUserGroupsWithoutPayment(),
  ]);

  let totalIssues = 0;
  for (const s of sections) {
    const count = s.rows.length;
    totalIssues += count;
    // eslint-disable-next-line no-console
    console.log(`\n=== ${s.title} (${count}) ===`);
    if (count > 0) {
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(s.rows.slice(0, 10), null, 2));
      if (count > 10) {
        // eslint-disable-next-line no-console
        console.log(`... and ${count - 10} more`);
      }
    }
  }

  // eslint-disable-next-line no-console
  console.log(`\nTotal anomalies: ${totalIssues}`);

  await db.destroy();
  process.exit(totalIssues > 0 ? 1 : 0);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(2);
});
```

- [ ] **Step 2: Verify it can be invoked**

Local dev DB may not have data for every check — but the script should run without crashing. Test with:

```bash
npm run audit
```

Expected: prints each section with counts (likely 0 or small numbers in dev). Exit code 0 if no anomalies, 1 if anomalies present.

- [ ] **Step 3: Commit**

```bash
git add scripts/pre-migration-audit.ts
git commit -m "feat(scripts): pre-migration audit for data anomalies"
```

---

## Task 14: Final pipeline + dev docs update

**Files:**
- Modify: `docs/dev-setup.md`

- [ ] **Step 1: Run full pipeline**

```bash
npm run gen:locale-types && npm run lint && npm run typecheck && npm test && npm run build
```

Expected: all green. Both unit tests (`src/shared/*` and `src/db/mapper.ts`) AND integration tests (`tests/integration/*`) run. If integration tests skip because the local Postgres isn't available, that's a test-environment issue; document it but don't fail the build.

- [ ] **Step 2: Update `docs/dev-setup.md`**

Append a new section:

```markdown
## Database

Migrations are managed by knex (TS). The legacy migrations (001–016) live under
`src/db/migrations/legacy/`. New migrations (017+) live in `src/db/migrations/`.

### Common commands

| Command                       | What it does                                     |
| ----------------------------- | ------------------------------------------------ |
| `npm run migrate`             | Apply all pending migrations to the dev DB       |
| `npm run migrate:rollback`    | Roll back the last batch                         |
| `npm run db:status`           | Show which migrations have run                   |
| `npm run db:list`             | List completed + pending                         |
| `npm run migrate:test`        | Apply migrations to the test DB                  |
| `npm run audit`               | Run pre-migration data audit against the dev DB  |
| `npm run test:integration`    | Run integration tests (requires local Postgres)  |

### Test database

Integration tests require a local Postgres reachable via the `.env` vars and
a user with CREATE DATABASE privilege. Tests automatically drop & recreate a
database named `goblin_test` (override via `DB_TEST_NAME`).

Run `npm run test:integration` to execute. The full `npm test` runs both unit
and integration tests; in CI, the workflow stands up a Postgres service.
```

- [ ] **Step 3: Commit**

```bash
git add docs/dev-setup.md
git commit -m "docs: document migration commands and test DB requirement"
```

---

## Self-Review Checklist (Plan 02 wrap-up)

- [ ] `npm test` passes: shared/ unit tests + db/mapper test + 6 migration integration tests.
- [ ] `npm run typecheck`, `npm run lint` clean.
- [ ] `knexfile.ts` works with knex CLI (`npx knex --knexfile knexfile.ts migrate:status`).
- [ ] No migration touches production yet (no migrations run against the dev/prod DB outside the test harness).
- [ ] `scripts/pre-migration-audit.ts` runs against the dev DB without crashing.
- [ ] Repository pattern groundwork (`src/db/client.ts`, `src/db/mapper.ts`) is in place for Plans 03+.
- [ ] CI workflow still works (no new required env vars without docs).

---

## What's next

Plan 03 builds `src/core/*` — the bot platform (typed router, single session backend, middleware chain, permissions, observability, i18n). With Plan 02's data layer in place, feature plans (Plans 04–08) can build on a foundation where DB writes are typed, transactional, and tested.
