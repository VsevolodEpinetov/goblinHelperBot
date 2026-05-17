# Plan 01 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lay down the TypeScript project skeleton (build tooling, lint, tests, CI, directory structure) and implement `src/shared/*` — the pure-logic layer with full unit test coverage. Produces a tested codebase with zero production impact.

**Architecture:** TypeScript + Vitest for tests. ESLint with `no-restricted-imports` to enforce feature boundaries. Lefthook for pre-commit. The `src/shared/` modules are pure functions (no DB, no Telegraf, no I/O) so they are fast and easy to test in isolation. Every shared module that downstream features will depend on lands here with its unit tests, before any DB or bot code goes in.

**Tech Stack:** TypeScript 5.x, Node 20.x, Vitest, ESLint, Prettier, Lefthook, GitHub Actions, knex (declared as dep but not yet exercised), zod for runtime validation.

**Spec reference:** `docs/superpowers/specs/2026-05-17-bot-greenfield-rewrite-design.md` §2, §3.7 (i18n), §6.1 (unit tests).

**Out of scope for this plan:** Migrations content, `src/core/*`, `src/features/*`, `src/db/*` beyond a stub client. Those land in Plans 2–9.

**Working directory note:** The existing JS codebase stays in place. The TypeScript rewrite lives alongside it; we do NOT delete the old `index.js`, `modules/`, etc. yet. They get removed only at cutover (Plan 9). For this plan, the new code goes under `src/` and `tests/` and does not interfere with the running bot.

---

## File Structure

**Created:**
- `tsconfig.json`
- `tsconfig.build.json`
- `vitest.config.ts`
- `.eslintrc.cjs`
- `.prettierrc.json`
- `.prettierignore`
- `lefthook.yml`
- `.github/workflows/ci.yml`
- `.env.example`
- `src/index.ts` (skeleton — just prints boot message)
- `src/db/client.ts` (stub knex client export)
- `src/types/telegraf.d.ts` (basic Context augmentation)
- `src/shared/period.ts` + `src/shared/period.test.ts`
- `src/shared/pricing.ts` + `src/shared/pricing.test.ts`
- `src/shared/xp.ts` + `src/shared/xp.test.ts`
- `src/shared/achievements.ts` + `src/shared/achievements.test.ts`
- `src/shared/loyalty-config.ts` + `src/shared/loyalty-config.test.ts`
- `src/shared/format.ts` + `src/shared/format.test.ts`
- `scripts/gen-locale-types.ts`
- `src/core/i18n-keys.generated.ts` (output of the locale gen script)
- `docs/dev-setup.md`

**Modified:**
- `package.json` — add TS toolchain, scripts, deps
- `.gitignore` — add `dist/`, `coverage/`, `.env`, generated files

---

## Task 1: Initialize TypeScript and update package.json

**Files:**
- Modify: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.build.json`
- Modify: `.gitignore`

- [ ] **Step 1: Read current package.json to confirm baseline**

```bash
cat package.json
```

Expected: the existing JS-only package.json with `start: node index.js` and the deps list. Confirm you see `telegraf`, `knex`, `pg`, `redis`, `dotenv`.

- [ ] **Step 2: Update package.json to add TS toolchain**

Replace `package.json` with:

```json
{
  "name": "goblin-helper-bot",
  "version": "2.0.0",
  "type": "commonjs",
  "scripts": {
    "start": "node index.js",
    "dev": "nodemon index.js",
    "start:new": "node dist/index.js",
    "dev:new": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.build.json",
    "typecheck": "tsc --noEmit",
    "lint": "eslint . --ext .ts,.tsx,.js,.cjs",
    "lint:fix": "eslint . --ext .ts,.tsx,.js,.cjs --fix",
    "format": "prettier --write \"src/**/*.{ts,tsx,json}\" \"tests/**/*.ts\"",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "gen:locale-types": "tsx scripts/gen-locale-types.ts",
    "migrate": "knex migrate:latest",
    "migrate:rollback": "knex migrate:rollback",
    "seed": "knex seed:run",
    "db:status": "knex migrate:status",
    "db:list": "knex migrate:list"
  },
  "dependencies": {
    "@notionhq/client": "^2.2.15",
    "@telegraf/session": "^2.0.0-beta.7",
    "axios": "^1.4.0",
    "canvas": "^3.1.2",
    "dayjs": "^1.11.7",
    "dotenv": "^16.6.1",
    "form-data": "^4.0.0",
    "knex": "^3.1.0",
    "lru-cache": "^11.0.0",
    "pg": "^8.13.1",
    "pino": "^9.0.0",
    "redis": "^4.7.1",
    "telegraf": "^4.16.3",
    "telegraf-session-redis-upd": "^5.1.4",
    "telegraf-throttler": "^0.6.0",
    "yandex-disk": "^0.0.8",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "@typescript-eslint/eslint-plugin": "^7.13.0",
    "@typescript-eslint/parser": "^7.13.0",
    "@vitest/coverage-v8": "^1.6.0",
    "eslint": "^8.57.0",
    "eslint-plugin-import": "^2.29.1",
    "lefthook": "^1.6.0",
    "nodemon": "^3.1.10",
    "pino-pretty": "^11.0.0",
    "prettier": "^3.3.0",
    "tsx": "^4.15.0",
    "typescript": "^5.5.0",
    "vitest": "^1.6.0"
  }
}
```

Then run `npm install`.

Expected: install completes without errors. `npm ls typescript` shows `typescript@5.5.x`.

- [ ] **Step 3: Create `tsconfig.json` (editor + dev)**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "moduleResolution": "node",
    "rootDir": ".",
    "outDir": "./dist",
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUncheckedIndexedAccess": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": false,
    "sourceMap": true,
    "incremental": true,
    "isolatedModules": true,
    "types": ["node", "vitest/globals"],
    "paths": {
      "@core/*": ["./src/core/*"],
      "@shared/*": ["./src/shared/*"],
      "@db/*": ["./src/db/*"],
      "@features/*": ["./src/features/*"]
    },
    "baseUrl": "."
  },
  "include": ["src/**/*", "tests/**/*", "scripts/**/*"],
  "exclude": ["node_modules", "dist", "modules", "index.js", "indexf.js", "INTEGRATION_EXAMPLES.js"]
}
```

- [ ] **Step 4: Create `tsconfig.build.json` (production build, excludes tests)**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "sourceMap": false,
    "removeComments": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "modules", "tests", "**/*.test.ts", "**/*.spec.ts"]
}
```

- [ ] **Step 5: Update `.gitignore`**

Read the current `.gitignore`:

```bash
cat .gitignore
```

Append the following block at the end if not already present:

```
# TypeScript build
dist/
*.tsbuildinfo

# Test coverage
coverage/

# Generated files
src/core/i18n-keys.generated.ts

# Environment
.env
.env.local

# Editor
.vscode/
.idea/
```

- [ ] **Step 6: Confirm typecheck baseline**

```bash
npx tsc --noEmit
```

Expected: no errors (no TS files exist yet under `src/`, so it should pass cleanly).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json tsconfig.json tsconfig.build.json .gitignore
git commit -m "chore: add TypeScript toolchain and tsconfigs"
```

---

## Task 2: Set up ESLint with feature boundary rules

**Files:**
- Create: `.eslintrc.cjs`
- Create: `.eslintignore`

- [ ] **Step 1: Create `.eslintrc.cjs`**

```javascript
/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  plugins: ['@typescript-eslint', 'import'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
  ],
  settings: {
    'import/resolver': {
      typescript: { project: './tsconfig.json' },
      node: true,
    },
  },
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/consistent-type-imports': 'error',
    'import/order': [
      'error',
      {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        'newlines-between': 'always',
        alphabetize: { order: 'asc' },
      },
    ],
    // Feature boundary enforcement + knex isolation, both in one rule.
    // Note: no-restricted-syntax can't check the IMPORTING file path
    // (only the import specifier), so file-path restrictions are
    // expressed via the override block below.
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: [
              '@features/*/repo',
              '@features/*/repo.*',
              '@features/*/service',
              '@features/*/service.*',
            ],
            message:
              "Features must not import sibling features' internal repo/service modules. Import the feature's public surface via @features/<name> instead.",
          },
        ],
        paths: [
          {
            name: 'knex',
            message:
              "Direct knex imports are only allowed in repo.ts files. Use the feature's repo layer.",
          },
          {
            name: '@db/client',
            message:
              "Direct db client imports are only allowed in repo.ts files. Use the feature's repo layer.",
          },
        ],
      },
    ],
  },
  overrides: [
    {
      // repo.ts files, the db layer, and scripts may import knex/db directly.
      // We redefine no-restricted-imports here so feature-boundary patterns
      // still apply, but the knex/db `paths` entries are dropped.
      files: ['src/features/**/repo.ts', 'src/db/**', 'scripts/**'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: [
                  '@features/*/repo',
                  '@features/*/repo.*',
                  '@features/*/service',
                  '@features/*/service.*',
                ],
                message:
                  "Features must not import sibling features' internal repo/service modules. Import the feature's public surface via @features/<name> instead.",
              },
            ],
          },
        ],
      },
    },
    {
      // Tests can import freely
      files: ['**/*.test.ts', '**/*.spec.ts', 'tests/**'],
      rules: {
        'no-restricted-imports': 'off',
      },
    },
    {
      // Legacy JS files are not linted by this config; keep them out of scope
      files: ['modules/**', 'index.js', 'indexf.js', 'INTEGRATION_EXAMPLES.js', 'scripts/*.js'],
      rules: {
        '@typescript-eslint/no-var-requires': 'off',
      },
    },
  ],
};
```

- [ ] **Step 2: Create `.eslintignore`**

```
node_modules
dist
coverage
modules
backups
index.js
indexf.js
INTEGRATION_EXAMPLES.js
scripts/*.js
src/core/i18n-keys.generated.ts
```

- [ ] **Step 3: Run lint to confirm clean baseline**

```bash
npm run lint
```

Expected: zero errors (no TS files yet under `src/`).

- [ ] **Step 4: Commit**

```bash
git add .eslintrc.cjs .eslintignore
git commit -m "chore: add ESLint with feature boundary rules"
```

---

## Task 3: Set up Prettier

**Files:**
- Create: `.prettierrc.json`
- Create: `.prettierignore`

- [ ] **Step 1: Create `.prettierrc.json`**

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

- [ ] **Step 2: Create `.prettierignore`**

```
node_modules
dist
coverage
modules
backups
locales
package-lock.json
*.md
.env*
```

- [ ] **Step 3: Run format on the (empty) source tree**

```bash
npm run format
```

Expected: prints "No matching files. Patterns: src/**/*.{ts,tsx,json} tests/**/*.ts" or formats zero files.

- [ ] **Step 4: Commit**

```bash
git add .prettierrc.json .prettierignore
git commit -m "chore: add Prettier configuration"
```

---

## Task 4: Set up Vitest

**Files:**
- Create: `vitest.config.ts`

- [ ] **Step 1: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts', 'tests/**/*.{test,spec}.ts'],
    exclude: ['node_modules', 'dist', 'modules'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.{test,spec}.ts', 'src/**/*.d.ts', 'src/core/i18n-keys.generated.ts'],
    },
  },
  resolve: {
    alias: {
      '@core': path.resolve(__dirname, 'src/core'),
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@db': path.resolve(__dirname, 'src/db'),
      '@features': path.resolve(__dirname, 'src/features'),
    },
  },
});
```

- [ ] **Step 2: Run vitest to confirm setup**

```bash
npm test
```

Expected: "No test files found, exiting with code 0" or similar. Setup is valid.

- [ ] **Step 3: Commit**

```bash
git add vitest.config.ts
git commit -m "chore: add Vitest configuration"
```

---

## Task 5: Set up Lefthook pre-commit hooks

**Files:**
- Create: `lefthook.yml`

- [ ] **Step 1: Create `lefthook.yml`**

```yaml
pre-commit:
  parallel: true
  commands:
    typecheck:
      run: npx tsc --noEmit
    lint:
      glob: '*.{ts,tsx,js,cjs}'
      run: npx eslint {staged_files}
    format:
      glob: '*.{ts,tsx,json}'
      run: npx prettier --check {staged_files}

pre-push:
  commands:
    test:
      run: npm test
```

- [ ] **Step 2: Install lefthook hooks into git**

```bash
npx lefthook install
```

Expected: "SYNCING" output and confirmation that hooks are installed in `.git/hooks/`.

- [ ] **Step 3: Verify by listing hooks**

```bash
ls -la .git/hooks/pre-commit .git/hooks/pre-push
```

Expected: both files exist and are managed by lefthook.

- [ ] **Step 4: Commit**

```bash
git add lefthook.yml
git commit -m "chore: add Lefthook pre-commit hooks"
```

---

## Task 6: Set up GitHub Actions CI

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create the workflow directory and file**

```bash
mkdir -p .github/workflows
```

`.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main, rewrite]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [20.x]

    steps:
      - uses: actions/checkout@v4

      - name: Use Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Generate locale types
        run: npm run gen:locale-types

      - name: Lint
        run: npm run lint

      - name: Typecheck
        run: npm run typecheck

      - name: Test
        run: npm test

      - name: Build
        run: npm run build
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "chore: add GitHub Actions CI workflow"
```

---

## Task 7: Create directory structure and stub files

**Files:**
- Create: `src/index.ts`
- Create: `src/db/client.ts`
- Create: `src/types/telegraf.d.ts`
- Create: `.env.example`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p src/core/middleware src/shared src/db/migrations src/db/seeds src/features src/types tests/unit tests/integration tests/fixtures
```

- [ ] **Step 2: Create `.env.example`**

```
# Telegram
TOKEN=

# PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=goblin_bot
DB_USER=goblin
DB_PASSWORD=

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Session backend
USE_REDIS_SESSIONS=true

# Observability (optional)
SENTRY_DSN=
LOG_LEVEL=info

# Notion (optional, currently dropped from scope)
# NOTION_TOKEN=
# NOTION_DB=
```

- [ ] **Step 3: Create `src/types/telegraf.d.ts` with a minimal Context augmentation**

```typescript
import 'telegraf';

declare module 'telegraf' {
  interface Context {
    // Populated by core/middleware/rbac.ts in a later plan.
    state: {
      roles?: string[];
    };
  }
}

export {};
```

- [ ] **Step 4: Create `src/db/client.ts` as a stub (real config arrives in Plan 2)**

```typescript
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
```

- [ ] **Step 5: Create `src/index.ts` as a boot-only skeleton**

```typescript
import 'dotenv/config';

async function main(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log('goblin-helper-bot v2 — skeleton boot. Features and bot launch arrive in Plan 03.');
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal boot error:', err);
  process.exit(1);
});
```

- [ ] **Step 6: Run typecheck and build to verify**

```bash
npm run typecheck
npm run build
```

Expected: both pass. `dist/index.js` exists.

- [ ] **Step 7: Commit**

```bash
git add src/index.ts src/db/client.ts src/types/telegraf.d.ts .env.example
git commit -m "chore: scaffold src/ directory and skeleton entry point"
```

---

## Task 8: Build shared/period.ts (TDD)

The `period` module replaces the scattered date logic in current `modules/date.js` and `modules/util.js`'s `getCurrentPeriod`. It's the canonical period (year + month) calculator the rest of the bot will use.

**Files:**
- Create: `src/shared/period.ts`
- Create: `src/shared/period.test.ts`

- [ ] **Step 1: Write the failing test (`src/shared/period.test.ts`)**

```typescript
import { describe, expect, it } from 'vitest';

import {
  currentPeriod,
  formatPeriod,
  isHistoricalPeriod,
  parsePeriod,
  periodFromDate,
} from './period';

describe('period', () => {
  describe('periodFromDate', () => {
    it('returns year and month for a given date', () => {
      const period = periodFromDate(new Date('2026-05-17T10:00:00Z'));
      expect(period).toEqual({ year: 2026, month: 5 });
    });

    it('returns month=1 for January', () => {
      const period = periodFromDate(new Date('2026-01-01T00:00:00Z'));
      expect(period).toEqual({ year: 2026, month: 1 });
    });

    it('returns month=12 for December', () => {
      const period = periodFromDate(new Date('2026-12-31T23:59:59Z'));
      expect(period).toEqual({ year: 2026, month: 12 });
    });
  });

  describe('formatPeriod', () => {
    it('formats period as YYYY_MM with zero-padded month', () => {
      expect(formatPeriod({ year: 2026, month: 5 })).toBe('2026_05');
    });

    it('does not pad two-digit months', () => {
      expect(formatPeriod({ year: 2026, month: 12 })).toBe('2026_12');
    });
  });

  describe('parsePeriod', () => {
    it('parses YYYY_MM string into period object', () => {
      expect(parsePeriod('2026_05')).toEqual({ year: 2026, month: 5 });
    });

    it('parses YYYY_MM with single-digit month', () => {
      expect(parsePeriod('2026_5')).toEqual({ year: 2026, month: 5 });
    });

    it('throws on malformed input', () => {
      expect(() => parsePeriod('bogus')).toThrow();
      expect(() => parsePeriod('2026')).toThrow();
      expect(() => parsePeriod('2026_13')).toThrow();
      expect(() => parsePeriod('2026_0')).toThrow();
    });
  });

  describe('isHistoricalPeriod', () => {
    const today = { year: 2026, month: 5 };

    it('returns false for the current period', () => {
      expect(isHistoricalPeriod({ year: 2026, month: 5 }, today)).toBe(false);
    });

    it('returns false for future periods', () => {
      expect(isHistoricalPeriod({ year: 2026, month: 6 }, today)).toBe(false);
      expect(isHistoricalPeriod({ year: 2027, month: 1 }, today)).toBe(false);
    });

    it('returns true for past periods within the same year', () => {
      expect(isHistoricalPeriod({ year: 2026, month: 4 }, today)).toBe(true);
    });

    it('returns true for past years', () => {
      expect(isHistoricalPeriod({ year: 2025, month: 12 }, today)).toBe(true);
      expect(isHistoricalPeriod({ year: 2024, month: 6 }, today)).toBe(true);
    });
  });

  describe('currentPeriod', () => {
    it('returns a period object derived from the current date', () => {
      const period = currentPeriod();
      expect(period.year).toBeGreaterThanOrEqual(2026);
      expect(period.month).toBeGreaterThanOrEqual(1);
      expect(period.month).toBeLessThanOrEqual(12);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/shared/period.test.ts
```

Expected: fails — `Failed to load url ./period`.

- [ ] **Step 3: Implement `src/shared/period.ts`**

```typescript
export interface Period {
  year: number;
  month: number;
}

export function periodFromDate(date: Date): Period {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
  };
}

export function currentPeriod(): Period {
  return periodFromDate(new Date());
}

export function formatPeriod(period: Period): string {
  const mm = String(period.month).padStart(2, '0');
  return `${period.year}_${mm}`;
}

export function parsePeriod(input: string): Period {
  const match = /^(\d{4})_(\d{1,2})$/.exec(input);
  if (!match) {
    throw new Error(`Invalid period string: "${input}". Expected YYYY_MM.`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) {
    throw new Error(`Invalid month ${month} in period "${input}". Must be 1–12.`);
  }
  return { year, month };
}

export function isHistoricalPeriod(period: Period, reference: Period = currentPeriod()): boolean {
  if (period.year < reference.year) return true;
  if (period.year > reference.year) return false;
  return period.month < reference.month;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/shared/period.test.ts
```

Expected: all 15+ assertions pass.

- [ ] **Step 5: Commit**

```bash
git add src/shared/period.ts src/shared/period.test.ts
git commit -m "feat(shared): add period helper with full unit coverage"
```

---

## Task 9: Build shared/loyalty-config.ts (data only, types tested)

This consolidates the tier definitions from current `configs/rpg.js`. Tier data ported verbatim from the source — the spec drops manual `userLoyalty` overrides, so tiers are XP-driven only.

**Files:**
- Create: `src/shared/loyalty-config.ts`
- Create: `src/shared/loyalty-config.test.ts`

- [ ] **Step 1: Write the failing test (`src/shared/loyalty-config.test.ts`)**

```typescript
import { describe, expect, it } from 'vitest';

import { TIERS, getNextTier, getTierByXp, tierByName } from './loyalty-config';

describe('loyalty-config', () => {
  it('exposes 8 tiers (wood → legend)', () => {
    expect(TIERS).toHaveLength(8);
    expect(TIERS[0]!.name).toBe('wood');
    expect(TIERS[7]!.name).toBe('legend');
  });

  it('tiers are in ascending xpMin order', () => {
    for (let i = 1; i < TIERS.length; i += 1) {
      expect(TIERS[i]!.xpMin).toBeGreaterThan(TIERS[i - 1]!.xpMin);
    }
  });

  it('first tier starts at 0 xp, last tier has no xpMax', () => {
    expect(TIERS[0]!.xpMin).toBe(0);
    expect(TIERS[7]!.xpMax).toBeNull();
  });

  it('every tier has the required fields populated', () => {
    for (const tier of TIERS) {
      expect(tier.name).toBeTruthy();
      expect(tier.displayName).toBeTruthy();
      expect(tier.emoji).toBeTruthy();
      expect(tier.discountPercent).toBeGreaterThanOrEqual(0);
      expect(tier.discountPercent).toBeLessThanOrEqual(100);
      expect(Array.isArray(tier.benefits)).toBe(true);
      expect(tier.benefits.length).toBeGreaterThan(0);
    }
  });

  it('the legend tier has levelStep set; others have finite levels', () => {
    const legend = TIERS[7]!;
    expect(legend.levels).toBeNull();
    expect(legend.levelStep).toBe(10000);
    for (let i = 0; i < TIERS.length - 1; i += 1) {
      expect(TIERS[i]!.levels).toBe(10);
      expect(TIERS[i]!.levelStep).toBeUndefined();
    }
  });

  describe('getTierByXp', () => {
    it('returns wood for 0 xp', () => {
      expect(getTierByXp(0).name).toBe('wood');
    });

    it('returns bronze at 2000 xp (lower boundary)', () => {
      expect(getTierByXp(2000).name).toBe('bronze');
    });

    it('returns wood at 1999 xp (one below bronze)', () => {
      expect(getTierByXp(1999).name).toBe('wood');
    });

    it('returns legend at 160000 and above', () => {
      expect(getTierByXp(160000).name).toBe('legend');
      expect(getTierByXp(1_000_000).name).toBe('legend');
    });

    it('clamps negative xp to wood', () => {
      expect(getTierByXp(-50).name).toBe('wood');
    });
  });

  describe('tierByName', () => {
    it('returns the tier for a known devName', () => {
      expect(tierByName('gold')?.displayName).toBe('Золотой');
    });

    it('returns undefined for an unknown name', () => {
      expect(tierByName('does-not-exist')).toBeUndefined();
    });
  });

  describe('getNextTier', () => {
    it('returns the tier above the given one', () => {
      expect(getNextTier('wood')?.name).toBe('bronze');
      expect(getNextTier('mithril')?.name).toBe('legend');
    });

    it('returns null at the top tier', () => {
      expect(getNextTier('legend')).toBeNull();
    });

    it('returns null for an unknown tier name', () => {
      expect(getNextTier('nope')).toBeNull();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/shared/loyalty-config.test.ts
```

Expected: fails — module not found.

- [ ] **Step 3: Implement `src/shared/loyalty-config.ts`**

Tier data is ported verbatim from `configs/rpg.js` (snapshot taken when this plan was authored). Discount percentages, XP ranges, level counts, descriptions, and benefit strings match the source exactly.

```typescript
export interface Tier {
  /** Stable identifier used across the codebase (was `devName` in the JS config). */
  name: string;
  /** User-facing display name in Russian. */
  displayName: string;
  /** Emoji shown next to the tier. */
  emoji: string;
  /** Inclusive lower XP boundary. */
  xpMin: number;
  /** Inclusive upper XP boundary, or null for the top tier. */
  xpMax: number | null;
  /** Number of sub-levels within the tier (null for the open-ended top tier). */
  levels: number | null;
  /** XP per level for the open-ended top tier only. */
  levelStep?: number;
  /** Flavor text shown in profile screens. */
  description: string;
  /** User-facing benefit strings shown in profile/help. */
  benefits: readonly string[];
  /** Discount applied at this tier (0–100). */
  discountPercent: number;
}

/**
 * Canonical tier list — single source of truth for the rewrite.
 * Ported from configs/rpg.js. Manual overrides via the deprecated
 * userLoyalty table are removed in the rewrite.
 */
export const TIERS: readonly Tier[] = [
  {
    name: 'wood',
    displayName: 'Деревянный',
    emoji: '🪵',
    xpMin: 0,
    xpMax: 1999,
    levels: 10,
    description: 'Начало пути. Ты только учишься мастерству.',
    benefits: ['Базовый доступ к контенту', 'Участие в опросах', 'Базовая поддержка'],
    discountPercent: 0,
  },
  {
    name: 'bronze',
    displayName: 'Бронзовый',
    emoji: '🥉',
    xpMin: 2000,
    xpMax: 4999,
    levels: 10,
    description: 'Базовое мастерство. Твои навыки растут.',
    benefits: [
      'Все преимущества Деревянного',
      'Приоритетная поддержка',
      'Доступ к эксклюзивному контенту',
      '5% скидка на покупки',
    ],
    discountPercent: 5,
  },
  {
    name: 'silver',
    displayName: 'Серебряный',
    emoji: '🥈',
    xpMin: 5000,
    xpMax: 9999,
    levels: 10,
    description: 'Растущая сила. Ты становишься заметным.',
    benefits: [
      'Все преимущества Бронзового',
      'Ранний доступ к новинкам',
      'Возможность создавать опросы',
      '10% скидка на покупки',
      'Кастомный бейдж профиля',
    ],
    discountPercent: 10,
  },
  {
    name: 'gold',
    displayName: 'Золотой',
    emoji: '🥇',
    xpMin: 10000,
    xpMax: 19999,
    levels: 10,
    description: 'Элитный статус. Ты среди лучших.',
    benefits: [
      'Все преимущества Серебряного',
      'VIP канал поддержки',
      'Доступ к бета-тестированию',
      '15% скидка на покупки',
      'Предложение новых функций',
    ],
    discountPercent: 15,
  },
  {
    name: 'platinum',
    displayName: 'Платиновый',
    emoji: '💎',
    xpMin: 20000,
    xpMax: 39999,
    levels: 10,
    description: 'Премиум уровень. Ты настоящий мастер.',
    benefits: [
      'Все преимущества Золотого',
      'Личный контакт с админом',
      '20% скидка на покупки',
      'Эксклюзивная роль в Discord',
    ],
    discountPercent: 20,
  },
  {
    name: 'diamond',
    displayName: 'Алмазный',
    emoji: '💠',
    xpMin: 40000,
    xpMax: 79999,
    levels: 10,
    description: 'Легендарный статус. Твоё имя известно всем.',
    benefits: [
      'Все преимущества Платинового',
      'Приглашение на ежегодную встречу',
      '25% скидка на покупки',
      'Признание легендарного статуса',
    ],
    discountPercent: 25,
  },
  {
    name: 'mithril',
    displayName: 'Мифриловый',
    emoji: '⚔️',
    xpMin: 80000,
    xpMax: 159999,
    levels: 10,
    description: 'Мастерский уровень. Ты легенда среди гоблинов.',
    benefits: [
      'Все преимущества Алмазного',
      'Привилегии мастерского уровня',
      '30% скидка на покупки',
      'Доступ к секретным проектам',
    ],
    discountPercent: 30,
  },
  {
    name: 'legend',
    displayName: 'Легендарный',
    emoji: '👑',
    xpMin: 160000,
    xpMax: null,
    levels: null,
    levelStep: 10000,
    description: 'Верховное мастерство. Ты - истинная легенда.',
    benefits: [
      'Все преимущества Мифрилового',
      'Признание высшего мастерства',
      '35% скидка на покупки',
      'Статус легендарного гоблина',
      'Бесконечное развитие',
    ],
    discountPercent: 35,
  },
] as const;

export function getTierByXp(xp: number): Tier {
  const clamped = Math.max(0, xp);
  let current: Tier = TIERS[0]!;
  for (const tier of TIERS) {
    if (clamped >= tier.xpMin) current = tier;
    else break;
  }
  return current;
}

export function tierByName(name: string): Tier | undefined {
  return TIERS.find((t) => t.name === name);
}

export function getNextTier(currentName: string): Tier | null {
  const idx = TIERS.findIndex((t) => t.name === currentName);
  if (idx < 0 || idx === TIERS.length - 1) return null;
  return TIERS[idx + 1]!;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/shared/loyalty-config.test.ts
```

Expected: all assertions pass.

- [ ] **Step 5: Commit**

```bash
git add src/shared/loyalty-config.ts src/shared/loyalty-config.test.ts
git commit -m "feat(shared): consolidate tier config into one source"
```

---

## Task 10: Build shared/pricing.ts (TDD)

`pricing.ts` is the canonical pricing calculator. Replaces the 4+ copies of price calculation scattered across `payCurrentMonth.js`, `upgradeToPlus.js`, `payPlusUpgrade.js`, `addPlusToCurrentMonth.js`, and `initiatePayment.js` — including the bug where `applyTestUserPricing` was missing from one path.

**Files:**
- Create: `src/shared/pricing.ts`
- Create: `src/shared/pricing.test.ts`

- [ ] **Step 1: Inspect current pricing logic for reference**

```bash
cat configs/rpg.js | grep -A 20 prices
cat modules/payments/pricingUtils.js
```

Note the current base prices for regular/plus monthly subscriptions, the test-user override pattern, and the `years_of_service` achievement discount (50% multiplier per the audit).

- [ ] **Step 2: Write the failing test (`src/shared/pricing.test.ts`)**

```typescript
import { describe, expect, it } from 'vitest';

import { computePrice } from './pricing';

describe('pricing', () => {
  describe('computePrice', () => {
    it('returns the base price for a regular user with no discount and no test override', () => {
      const result = computePrice({
        basePrice: 1000,
        yearsOfService: false,
        isTestUser: false,
      });
      expect(result.final).toBe(1000);
      expect(result.discountPercent).toBe(0);
      expect(result.source.testOverride).toBe(false);
    });

    it('applies the 50% years-of-service discount when eligible', () => {
      const result = computePrice({
        basePrice: 1000,
        yearsOfService: true,
        isTestUser: false,
      });
      expect(result.final).toBe(500);
      expect(result.discountPercent).toBe(50);
      expect(result.source.yearsOfService).toBe(true);
    });

    it('rounds the discounted price to the nearest integer', () => {
      const result = computePrice({
        basePrice: 999,
        yearsOfService: true,
        isTestUser: false,
      });
      // 999 * 0.5 = 499.5 → 500 (banker's rounding via Math.round)
      expect(result.final).toBe(500);
    });

    it('applies the test-user override regardless of other inputs', () => {
      const result = computePrice({
        basePrice: 1000,
        yearsOfService: true,
        isTestUser: true,
      });
      expect(result.final).toBe(1);
      expect(result.source.testOverride).toBe(true);
    });

    it('handles a zero base price by returning zero', () => {
      const result = computePrice({
        basePrice: 0,
        yearsOfService: false,
        isTestUser: false,
      });
      expect(result.final).toBe(0);
    });

    it('does not allow a negative base price', () => {
      expect(() =>
        computePrice({ basePrice: -10, yearsOfService: false, isTestUser: false }),
      ).toThrow(/non-negative/);
    });

    it('discount percent is reported even when test override fires', () => {
      const result = computePrice({
        basePrice: 1000,
        yearsOfService: true,
        isTestUser: true,
      });
      expect(result.discountPercent).toBe(50);
      expect(result.final).toBe(1);
    });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx vitest run src/shared/pricing.test.ts
```

Expected: fails — module not found.

- [ ] **Step 4: Implement `src/shared/pricing.ts`**

```typescript
export interface PriceInput {
  /** Base price in the target currency unit (XTR Stars or RUB). */
  basePrice: number;
  /** True when the user has the years_of_service achievement. */
  yearsOfService: boolean;
  /** True when the user is flagged as a test/dev user (1-unit override). */
  isTestUser: boolean;
}

export interface PriceResult {
  /** Final price the user is charged. */
  final: number;
  /** Discount applied (0–100), reported even when overridden. */
  discountPercent: number;
  /** Provenance of the final price for logging/observability. */
  source: {
    yearsOfService: boolean;
    testOverride: boolean;
  };
}

const YEARS_OF_SERVICE_MULTIPLIER = 0.5;
const TEST_USER_PRICE = 1;

export function computePrice(input: PriceInput): PriceResult {
  if (input.basePrice < 0) {
    throw new Error('basePrice must be non-negative');
  }

  const discountPercent = input.yearsOfService ? 50 : 0;
  const afterDiscount = input.yearsOfService
    ? Math.round(input.basePrice * YEARS_OF_SERVICE_MULTIPLIER)
    : input.basePrice;

  const final = input.isTestUser ? TEST_USER_PRICE : afterDiscount;

  return {
    final,
    discountPercent,
    source: {
      yearsOfService: input.yearsOfService,
      testOverride: input.isTestUser,
    },
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx vitest run src/shared/pricing.test.ts
```

Expected: all 7 assertions pass.

- [ ] **Step 6: Commit**

```bash
git add src/shared/pricing.ts src/shared/pricing.test.ts
git commit -m "feat(shared): add canonical pricing calculator"
```

---

## Task 11: Build shared/xp.ts (TDD)

XP calculation + tier-level resolution. Replaces divergent formulas in current `xpService.js` and `rpgUtils.js`. The level-in-tier algorithm matches the existing JS exactly so user-visible levels stay stable across the rewrite.

**Files:**
- Create: `src/shared/xp.ts`
- Create: `src/shared/xp.test.ts`

- [ ] **Step 1: Write the failing test (`src/shared/xp.test.ts`)**

```typescript
import { describe, expect, it } from 'vitest';

import { TIERS, tierByName } from './loyalty-config';
import { computeRank, xpForSpending } from './xp';

describe('xp', () => {
  describe('xpForSpending', () => {
    it('converts spending units to XP using the 1.3 multiplier', () => {
      expect(xpForSpending(100)).toBe(130);
    });

    it('rounds down when the result is fractional', () => {
      // 7 * 1.3 = 9.1 → 9
      expect(xpForSpending(7)).toBe(9);
    });

    it('returns 0 for 0 spending', () => {
      expect(xpForSpending(0)).toBe(0);
    });

    it('throws on negative spending', () => {
      expect(() => xpForSpending(-5)).toThrow(/non-negative/);
    });
  });

  describe('computeRank', () => {
    it('returns wood tier level 1 for 0 xp', () => {
      const rank = computeRank(0);
      expect(rank.tier.name).toBe('wood');
      expect(rank.level).toBe(1);
    });

    it('returns wood tier highest level near the upper boundary', () => {
      // wood: 0..1999 over 10 levels → 200 xp per level
      const rank = computeRank(1999);
      expect(rank.tier.name).toBe('wood');
      expect(rank.level).toBe(10);
    });

    it('jumps to bronze at exactly 2000 xp', () => {
      const rank = computeRank(2000);
      expect(rank.tier.name).toBe('bronze');
      expect(rank.level).toBe(1);
    });

    it('places gold tier user at the expected level', () => {
      // gold: 10000..19999 over 10 levels → 1000 xp per level
      // 14500 xp → 4500 into tier → level floor(4500/1000)+1 = 5
      const rank = computeRank(14500);
      expect(rank.tier.name).toBe('gold');
      expect(rank.level).toBe(5);
    });

    it('reports xpToNextLevel mid-level', () => {
      // gold @ 14500: 500 xp into level 5 → 500 xp to level 6
      const rank = computeRank(14500);
      expect(rank.xpToNextLevel).toBe(500);
    });

    it('handles the legend tier (open-ended)', () => {
      // legend: starts at 160000, levelStep 10000
      // 175000 xp → 15000 into tier → level 2; 5000 xp into level
      const rank = computeRank(175000);
      expect(rank.tier.name).toBe('legend');
      expect(rank.level).toBe(2);
      expect(rank.xpToNextLevel).toBe(5000);
    });

    it('nextTierXp is null at the legend tier', () => {
      expect(computeRank(200000).nextTierXp).toBeNull();
    });

    it('nextTierXp reports the next tier minXp below the top tier', () => {
      const rank = computeRank(500);
      expect(rank.nextTierXp).toBe(tierByName('bronze')!.xpMin);
    });

    it('clamps negative xp to wood level 1', () => {
      const rank = computeRank(-100);
      expect(rank.tier.name).toBe('wood');
      expect(rank.level).toBe(1);
    });
  });

  it('every tier produces a valid rank at its lower boundary', () => {
    for (const tier of TIERS) {
      const rank = computeRank(tier.xpMin);
      expect(rank.tier.name).toBe(tier.name);
      expect(rank.level).toBe(1);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/shared/xp.test.ts
```

Expected: fails — module not found.

- [ ] **Step 3: Implement `src/shared/xp.ts`**

```typescript
import { getNextTier, getTierByXp, type Tier } from './loyalty-config';

const SPENDING_TO_XP_RATE = 1.3;

export function xpForSpending(spendingUnits: number): number {
  if (spendingUnits < 0) {
    throw new Error('spendingUnits must be non-negative');
  }
  return Math.floor(spendingUnits * SPENDING_TO_XP_RATE);
}

export interface Rank {
  /** Tier the user is currently in. */
  tier: Tier;
  /** 1-based level within the tier. */
  level: number;
  /** XP needed to reach the next level. */
  xpToNextLevel: number;
  /** Minimum XP of the next tier, or null if at top tier. */
  nextTierXp: number | null;
}

/**
 * Calculate a user's full rank from total XP.
 *
 * Mirrors the existing JS algorithm in configs/rpg.js::calculateRankFromXp
 * so visible levels stay stable across the rewrite cutover.
 */
export function computeRank(totalXp: number): Rank {
  const xp = Math.max(0, totalXp);
  const tier = getTierByXp(xp);
  const next = getNextTier(tier.name);

  if (tier.xpMax === null) {
    // Open-ended top tier: each `levelStep` XP is one level.
    const step = tier.levelStep ?? 10000;
    const extra = Math.max(0, xp - tier.xpMin);
    const level = 1 + Math.floor(extra / step);
    const xpIntoLevel = extra % step;
    const xpToNextLevel = step - xpIntoLevel;
    return { tier, level, xpToNextLevel, nextTierXp: null };
  }

  // Finite tier: xpRange divided into `tier.levels` even slices.
  const xpRange = tier.xpMax - tier.xpMin + 1;
  const levels = tier.levels ?? 1;
  const xpPerLevel = xpRange / levels;
  const xpIntoTier = Math.max(0, xp - tier.xpMin);
  const level = Math.min(levels, Math.floor(xpIntoTier / xpPerLevel) + 1);
  const xpIntoLevel = xpIntoTier % xpPerLevel;
  const xpToNextLevel =
    level === levels
      ? tier.xpMax - xp // last level in tier: XP until next tier
      : Math.ceil(xpPerLevel - xpIntoLevel);

  return {
    tier,
    level,
    xpToNextLevel,
    nextTierXp: next ? next.xpMin : null,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/shared/xp.test.ts
```

Expected: all assertions pass.

- [ ] **Step 5: Commit**

```bash
git add src/shared/xp.ts src/shared/xp.test.ts
git commit -m "feat(shared): add unified XP/rank calculator matching legacy formula"
```

---

## Task 12: Build shared/achievements.ts (TDD)

Achievement definitions and gate helpers. The `sbp_payment` achievement is the gate for SBP payment buttons; `years_of_service` triggers the discount.

**Files:**
- Create: `src/shared/achievements.ts`
- Create: `src/shared/achievements.test.ts`

- [ ] **Step 1: Write the failing test (`src/shared/achievements.test.ts`)**

```typescript
import { describe, expect, it } from 'vitest';

import {
  ACHIEVEMENT_KEYS,
  ACHIEVEMENTS,
  canPayViaSbp,
  hasYearsOfService,
  isKnownAchievement,
} from './achievements';

describe('achievements', () => {
  it('exposes a closed set of achievement keys', () => {
    expect(ACHIEVEMENT_KEYS).toContain('sbp_payment');
    expect(ACHIEVEMENT_KEYS).toContain('years_of_service');
  });

  it('every key has a definition with name and description', () => {
    for (const key of ACHIEVEMENT_KEYS) {
      const def = ACHIEVEMENTS[key];
      expect(def).toBeDefined();
      expect(typeof def.displayName).toBe('string');
      expect(def.displayName.length).toBeGreaterThan(0);
      expect(typeof def.description).toBe('string');
    }
  });

  describe('isKnownAchievement', () => {
    it('returns true for known keys', () => {
      expect(isKnownAchievement('sbp_payment')).toBe(true);
      expect(isKnownAchievement('years_of_service')).toBe(true);
    });

    it('returns false for unknown keys', () => {
      expect(isKnownAchievement('totally_made_up')).toBe(false);
      expect(isKnownAchievement('')).toBe(false);
    });
  });

  describe('canPayViaSbp', () => {
    it('returns true when user has sbp_payment achievement', () => {
      expect(canPayViaSbp(['sbp_payment'])).toBe(true);
    });

    it('returns true when sbp_payment is among other achievements', () => {
      expect(canPayViaSbp(['years_of_service', 'sbp_payment'])).toBe(true);
    });

    it('returns false when sbp_payment is absent', () => {
      expect(canPayViaSbp(['years_of_service'])).toBe(false);
      expect(canPayViaSbp([])).toBe(false);
    });
  });

  describe('hasYearsOfService', () => {
    it('returns true when present', () => {
      expect(hasYearsOfService(['years_of_service'])).toBe(true);
    });

    it('returns false when absent', () => {
      expect(hasYearsOfService([])).toBe(false);
      expect(hasYearsOfService(['sbp_payment'])).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/shared/achievements.test.ts
```

Expected: fails — module not found.

- [ ] **Step 3: Implement `src/shared/achievements.ts`**

```typescript
export const ACHIEVEMENT_KEYS = ['sbp_payment', 'years_of_service'] as const;

export type AchievementKey = (typeof ACHIEVEMENT_KEYS)[number];

interface AchievementDefinition {
  displayName: string;
  description: string;
}

export const ACHIEVEMENTS: Record<AchievementKey, AchievementDefinition> = {
  sbp_payment: {
    displayName: 'SBP-плательщик',
    description:
      'Право платить через СБП/перевод с подтверждением скриншотом. Назначается админом вручную.',
  },
  years_of_service: {
    displayName: 'Старожил',
    description: 'Постоянный участник; даёт 50% скидку на подписку.',
  },
};

export function isKnownAchievement(key: string): key is AchievementKey {
  return (ACHIEVEMENT_KEYS as readonly string[]).includes(key);
}

export function canPayViaSbp(userAchievements: readonly string[]): boolean {
  return userAchievements.includes('sbp_payment');
}

export function hasYearsOfService(userAchievements: readonly string[]): boolean {
  return userAchievements.includes('years_of_service');
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/shared/achievements.test.ts
```

Expected: all assertions pass.

- [ ] **Step 5: Commit**

```bash
git add src/shared/achievements.ts src/shared/achievements.test.ts
git commit -m "feat(shared): add achievement definitions and gate helpers"
```

---

## Task 13: Build shared/format.ts (TDD)

Message and button label helpers. This is where the shared raid message template (currently duplicated 5× in the JS codebase) will land in a later plan — for now we add the primitives.

**Files:**
- Create: `src/shared/format.ts`
- Create: `src/shared/format.test.ts`

- [ ] **Step 1: Write the failing test (`src/shared/format.test.ts`)**

```typescript
import { describe, expect, it } from 'vitest';

import { escapeHtml, formatPrice, formatUserDisplay } from './format';

describe('format', () => {
  describe('escapeHtml', () => {
    it('escapes ampersands, angle brackets, and quotes', () => {
      expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
      expect(escapeHtml('<b>bold</b>')).toBe('&lt;b&gt;bold&lt;/b&gt;');
      expect(escapeHtml('"hi"')).toBe('&quot;hi&quot;');
    });

    it('leaves safe strings unchanged', () => {
      expect(escapeHtml('hello world')).toBe('hello world');
    });
  });

  describe('formatPrice', () => {
    it('formats stars as the price with XTR symbol', () => {
      expect(formatPrice(500, 'XTR')).toBe('500 ⭐');
    });

    it('formats rubles with the ruble sign', () => {
      expect(formatPrice(1500, 'RUB')).toBe('1500 ₽');
    });

    it('inserts thousand separators when amount is large', () => {
      expect(formatPrice(15000, 'RUB')).toBe('15 000 ₽');
    });
  });

  describe('formatUserDisplay', () => {
    it('uses @username when set and not "not_set"', () => {
      expect(
        formatUserDisplay({
          id: 1,
          username: 'goblin_user',
          firstName: 'Goblin',
          lastName: 'User',
        }),
      ).toBe('@goblin_user');
    });

    it('falls back to first+last name when username is not_set', () => {
      expect(
        formatUserDisplay({
          id: 1,
          username: 'not_set',
          firstName: 'Иван',
          lastName: 'Петров',
        }),
      ).toBe('Иван Петров');
    });

    it('falls back to first name only when no last name', () => {
      expect(
        formatUserDisplay({
          id: 1,
          username: 'not_set',
          firstName: 'Иван',
          lastName: null,
        }),
      ).toBe('Иван');
    });

    it('falls back to id when nothing else is available', () => {
      expect(
        formatUserDisplay({
          id: 42,
          username: 'not_set',
          firstName: null,
          lastName: null,
        }),
      ).toBe('id:42');
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/shared/format.test.ts
```

Expected: fails — module not found.

- [ ] **Step 3: Implement `src/shared/format.ts`**

```typescript
const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch] ?? ch);
}

export type Currency = 'XTR' | 'RUB' | 'USD' | 'EUR';

const CURRENCY_SYMBOL: Record<Currency, string> = {
  XTR: '⭐',
  RUB: '₽',
  USD: '$',
  EUR: '€',
};

export function formatPrice(amount: number, currency: Currency): string {
  const grouped = amount.toLocaleString('ru-RU').replace(/,/g, ' ');
  return `${grouped} ${CURRENCY_SYMBOL[currency]}`;
}

export interface UserDisplayInput {
  id: number;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
}

export function formatUserDisplay(user: UserDisplayInput): string {
  if (user.username && user.username !== 'not_set') {
    return `@${user.username}`;
  }
  const parts = [user.firstName, user.lastName].filter((p): p is string => Boolean(p));
  if (parts.length > 0) {
    return parts.join(' ');
  }
  return `id:${user.id}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/shared/format.test.ts
```

Expected: all assertions pass.

- [ ] **Step 5: Commit**

```bash
git add src/shared/format.ts src/shared/format.test.ts
git commit -m "feat(shared): add formatting helpers (html escape, price, user display)"
```

---

## Task 14: Build the locale type generator

Generates `src/core/i18n-keys.generated.ts` from `locales/ru.json` so `t('foo.bar')` is type-checked.

**Files:**
- Create: `scripts/gen-locale-types.ts`
- Create: `src/core/i18n-keys.generated.ts` (output)

- [ ] **Step 1: Confirm locale file exists**

```bash
ls -la locales/ru.json
```

Expected: file exists, ~44KB per the audit.

- [ ] **Step 2: Create `scripts/gen-locale-types.ts`**

```typescript
import { promises as fs } from 'node:fs';
import path from 'node:path';

const LOCALE_PATH = path.join(process.cwd(), 'locales', 'ru.json');
const OUTPUT_PATH = path.join(process.cwd(), 'src', 'core', 'i18n-keys.generated.ts');

function flattenKeys(obj: unknown, prefix = ''): string[] {
  if (typeof obj !== 'object' || obj === null) return [];
  const result: string[] = [];
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      result.push(full);
    } else if (typeof value === 'object' && value !== null) {
      result.push(...flattenKeys(value, full));
    }
  }
  return result;
}

async function main(): Promise<void> {
  const raw = await fs.readFile(LOCALE_PATH, 'utf-8');
  const data = JSON.parse(raw) as unknown;
  const keys = flattenKeys(data).sort();

  const body = [
    '// THIS FILE IS GENERATED. Do not edit by hand.',
    '// Regenerate with: npm run gen:locale-types',
    '',
    'export type LocaleKey =',
    ...keys.map((k, i) => `  | '${k}'${i === keys.length - 1 ? ';' : ''}`),
    '',
    `export const LOCALE_KEYS: readonly LocaleKey[] = [`,
    ...keys.map((k) => `  '${k}',`),
    '] as const;',
    '',
  ].join('\n');

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, body, 'utf-8');

  // eslint-disable-next-line no-console
  console.log(`Wrote ${keys.length} locale keys to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 3: Run the generator**

```bash
npm run gen:locale-types
```

Expected: console output `Wrote N locale keys to ...`. File `src/core/i18n-keys.generated.ts` exists.

- [ ] **Step 4: Verify the generated file compiles**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit (note: the generated file is gitignored, so only the script lands)**

```bash
git add scripts/gen-locale-types.ts
git commit -m "feat: locale type generator from ru.json"
```

---

## Task 15: Verify the full pipeline and update dev docs

**Files:**
- Create: `docs/dev-setup.md`

- [ ] **Step 1: Run the full local pipeline**

```bash
npm run gen:locale-types && npm run lint && npm run typecheck && npm test && npm run build
```

Expected: every step exits 0. Test summary shows all assertions from period/pricing/xp/achievements/loyalty-config/format tests passing.

- [ ] **Step 2: Create `docs/dev-setup.md`**

```markdown
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
```

- [ ] **Step 3: Commit**

```bash
git add docs/dev-setup.md
git commit -m "docs: add dev setup guide"
```

---

## Self-Review Checklist (run before declaring this plan done)

- [ ] All shared modules have tests, and `npm test` passes.
- [ ] `npm run lint` is clean.
- [ ] `npm run typecheck` is clean.
- [ ] `npm run build` produces `dist/index.js`.
- [ ] The legacy JS bot (`npm start`) still launches without errors — nothing in `src/` interferes.
- [ ] No `TODO`, `TBD`, or `// implement later` comments left in any `src/` file.
- [ ] `.env` is not staged or committed.
- [ ] The CI workflow file references the same scripts that exist in `package.json`.
- [ ] Loyalty tier data ported from `configs/rpg.js` matches the source values exactly — no invented tiers.

If anything fails, fix inline and re-run the affected steps before continuing to Plan 02.

---

## What's next

After this plan is executed and committed, **Plan 02 — Data layer** writes the migration files (017–022), the pre-migration audit script, and `src/db/client.ts` with real config and pool tuning. Plan 02 still does not touch production; migrations are written and tested against a local Postgres only.
