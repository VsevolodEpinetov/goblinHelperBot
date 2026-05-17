# Dev setup

## Prerequisites

- Node.js 20.x
- npm 10.x
- PostgreSQL 14+ (local or remote)
- Redis 6+ (local or remote)

## First-time setup

1. Copy `.env.example` to `.env` and fill in the required values.
2. `npm ci`
3. `npm run gen:locale-types`
4. `npm run typecheck`
5. `npm test`

## Common commands

| Command                       | What it does                                  |
| ----------------------------- | --------------------------------------------- |
| `npm run dev:new`             | Run the new TS bot in watch mode (Plan 03+)   |
| `npm run build`               | Compile TS to `dist/`                         |
| `npm start:new`               | Run the compiled new bot                      |
| `npm run lint`                | ESLint check                                  |
| `npm run lint:fix`            | ESLint auto-fix                               |
| `npm run typecheck`           | tsc --noEmit                                  |
| `npm test`                    | Vitest one-shot                               |
| `npm run test:watch`          | Vitest watch mode                             |
| `npm run gen:locale-types`    | Regenerate `src/core/i18n-keys.generated.ts`  |
| `npm run start` / `npm run dev` | Run the legacy JS bot (still in place)      |

## Layout

- `src/core/` — bot plumbing
- `src/shared/` — pure logic (pricing, xp, achievements, period, format)
- `src/db/` — knex client + migrations (filled in Plan 02)
- `src/features/` — feature folders (filled in Plans 03–08)
- `tests/` — unit + integration

The legacy JavaScript codebase (`index.js`, `modules/`) stays in place
until the cutover plan executes; nothing in `src/` interferes with it.

## Tips when writing code

- Indexing into arrays (`TIERS[0]`, `match[1]`) returns `T | undefined`
  because `noUncheckedIndexedAccess` is enabled. Use `!` non-null
  assertions when you know the value is present, or destructure with
  defaults. The same applies in tests.
- `repo.ts` files are the ONLY place that may import `knex` or
  `@db/client`. ESLint blocks direct imports everywhere else.
- Features must not import sibling features' internals — only the
  feature's public surface via `@features/<name>`.

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

`.env` needs (defaults shown):

```
DB_HOST=localhost
DB_PORT=5432
DB_USER=goblin
DB_PASSWORD=
DB_NAME=goblin_bot
DB_TEST_NAME=goblin_test
```

Run `npm run test:integration` to execute. Without Postgres, integration
tests fail with `ECONNREFUSED` — that's an environment issue, not a code
defect.

### Migrations 017–022 status

Written but not run against production:

- 017 — Retroactive table documentation (users, months, kickstarters, applications, settings)
- 018 — Rename camelCase columns to snake_case across 14 tables
- 019 — Payment idempotency: source column + UNIQUE indices
- 020 — UNIQUE(user_id, achievement_type) with dedupe
- 021 — Drop deprecated userLoyalty + 8 lots tables
- 022 — Collapse 6 typed Telegram columns on invitation_links into JSONB

Each migration has an integration test. Validate end-to-end against a
local Postgres before the cutover window (Plan 09).
