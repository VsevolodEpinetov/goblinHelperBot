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
