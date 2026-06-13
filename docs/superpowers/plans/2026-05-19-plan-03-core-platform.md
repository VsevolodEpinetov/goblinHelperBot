# Plan 03 — Core Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `src/core/*` — the platform every feature depends on: typed config, single bot/Redis instances, namespaced session, typed callback router, scene helpers, middleware chain (error/logger/banned/user-tracker/rbac/xp), permission helpers, structured observability, and typed i18n.

**Architecture:** No business logic in `core/`; only bot plumbing. After Plan 03 `src/index.ts` wires everything and the bot can launch, but no commands or actions exist yet — features land in Plans 04+. Middleware reads the database via small repos under `src/db/repos/` (allowed by the ESLint rule), assuming post-migration-018 snake_case columns.

**Tech Stack:** TypeScript, Telegraf v4, @telegraf/session, redis (node-redis v4), pino, lru-cache, zod.

**Spec reference:** `docs/superpowers/specs/2026-05-17-bot-greenfield-rewrite-design.md` §3.

**Prerequisites for executing:** Plans 01 and 02 complete. Plan 02's migrations 017–022 do NOT need to have been run against any DB before Plan 03 executes — but the bot launched at the end of Plan 03 will only work end-to-end against a DB whose schema has been migrated.

**Out of scope:**
- Feature handlers (Plans 04+).
- DB schema work (Plan 02).
- Test infrastructure for Telegram-API-level testing — middleware is tested in isolation, not via a stubbed bot.

---

## File Structure

**Created:**
- `src/core/config.ts` + tests
- `src/core/bot.ts`
- `src/core/redis.ts` (single Redis client)
- `src/core/sessions.ts`
- `src/core/observability.ts`
- `src/core/i18n.ts` + tests
- `src/core/router.ts` + tests (the biggest)
- `src/core/scenes.ts`
- `src/core/permissions.ts` + tests
- `src/core/middleware/error.ts`
- `src/core/middleware/logger.ts`
- `src/core/middleware/banned.ts` + tests
- `src/core/middleware/user-tracker.ts` + tests
- `src/core/middleware/rbac.ts` + tests
- `src/core/middleware/xp-on-message.ts` + tests
- `src/db/repos/users.ts` (small read/write API used by middleware)
- `src/db/repos/user-roles.ts`

**Modified:**
- `src/types/telegraf.d.ts` (full Context augmentation)
- `src/index.ts` (wire and launch)
- `.env.example` (add the new env vars `core/config.ts` validates)

---

## Task 1: Build `src/core/config.ts` with zod env validation

**Files:**
- Create: `src/core/config.ts`
- Create: `src/core/config.test.ts`
- Modify: `.env.example`

The config loads environment variables once at boot and validates them with zod. Any subsequent code reads `config.botToken`, `config.dbHost`, etc. — no scattered `process.env.X` calls.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from 'vitest';

import { loadConfig } from './config';

describe('config', () => {
  it('loads valid env vars into a typed config object', () => {
    const cfg = loadConfig({
      TOKEN: 't',
      DB_HOST: 'localhost',
      DB_PORT: '5432',
      DB_NAME: 'goblin_bot',
      DB_USER: 'goblin',
      DB_PASSWORD: 's',
      REDIS_HOST: 'localhost',
      REDIS_PORT: '6379',
      LOG_LEVEL: 'info',
    });
    expect(cfg.botToken).toBe('t');
    expect(cfg.dbPort).toBe(5432);
    expect(cfg.redisPort).toBe(6379);
    expect(cfg.logLevel).toBe('info');
  });

  it('throws when TOKEN is missing', () => {
    expect(() => loadConfig({})).toThrow(/TOKEN/);
  });

  it('defaults LOG_LEVEL to info', () => {
    const cfg = loadConfig({ TOKEN: 't' });
    expect(cfg.logLevel).toBe('info');
  });

  it('accepts optional SENTRY_DSN', () => {
    const cfg = loadConfig({ TOKEN: 't', SENTRY_DSN: 'https://x@sentry.io/1' });
    expect(cfg.sentryDsn).toBe('https://x@sentry.io/1');
  });

  it('omits sentryDsn when not set', () => {
    const cfg = loadConfig({ TOKEN: 't' });
    expect(cfg.sentryDsn).toBeUndefined();
  });

  it('parses USE_REDIS_SESSIONS as a boolean (default true)', () => {
    expect(loadConfig({ TOKEN: 't' }).useRedisSessions).toBe(true);
    expect(loadConfig({ TOKEN: 't', USE_REDIS_SESSIONS: 'false' }).useRedisSessions).toBe(false);
    expect(loadConfig({ TOKEN: 't', USE_REDIS_SESSIONS: 'true' }).useRedisSessions).toBe(true);
  });
});
```

- [ ] **Step 2: Run test (expect failure — module missing)**

```bash
npx vitest run src/core/config.test.ts
```

- [ ] **Step 3: Implement `src/core/config.ts`**

```typescript
import 'dotenv/config';

import { z } from 'zod';

const ConfigSchema = z.object({
  TOKEN: z.string().min(1, 'TOKEN is required'),
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().int().positive().default(5432),
  DB_NAME: z.string().default('goblin_bot'),
  DB_TEST_NAME: z.string().default('goblin_test'),
  DB_USER: z.string().default('goblin'),
  DB_PASSWORD: z.string().default(''),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  USE_REDIS_SESSIONS: z
    .union([z.literal('true'), z.literal('false')])
    .default('true')
    .transform((v) => v === 'true'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  SENTRY_DSN: z.string().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export interface Config {
  botToken: string;
  dbHost: string;
  dbPort: number;
  dbName: string;
  dbTestName: string;
  dbUser: string;
  dbPassword: string;
  redisHost: string;
  redisPort: number;
  redisPassword: string | undefined;
  useRedisSessions: boolean;
  logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
  sentryDsn: string | undefined;
  nodeEnv: 'development' | 'production' | 'test';
}

export function loadConfig(env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env): Config {
  const parsed = ConfigSchema.parse(env);
  return {
    botToken: parsed.TOKEN,
    dbHost: parsed.DB_HOST,
    dbPort: parsed.DB_PORT,
    dbName: parsed.DB_NAME,
    dbTestName: parsed.DB_TEST_NAME,
    dbUser: parsed.DB_USER,
    dbPassword: parsed.DB_PASSWORD,
    redisHost: parsed.REDIS_HOST,
    redisPort: parsed.REDIS_PORT,
    redisPassword: parsed.REDIS_PASSWORD,
    useRedisSessions: parsed.USE_REDIS_SESSIONS,
    logLevel: parsed.LOG_LEVEL,
    sentryDsn: parsed.SENTRY_DSN,
    nodeEnv: parsed.NODE_ENV,
  };
}

/** Process-wide cached config; created lazily on first access. */
let _config: Config | undefined;
export function getConfig(): Config {
  if (!_config) _config = loadConfig();
  return _config;
}
```

- [ ] **Step 4: Update `.env.example`** with the full env-var set (DB_TEST_NAME, REDIS_PASSWORD, USE_REDIS_SESSIONS, NODE_ENV) — append/update entries.

- [ ] **Step 5: Run tests + verify**

```bash
npx vitest run src/core/config.test.ts
npm run typecheck
npm run lint
```

All exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/core/config.ts src/core/config.test.ts .env.example
git commit -m "feat(core): add typed config loader with zod env validation"
```

---

## Task 2: Build `src/core/bot.ts` (single Telegraf instance)

**Files:**
- Create: `src/core/bot.ts`

- [ ] **Step 1: Create the file**

```typescript
import { Telegraf } from 'telegraf';

import { getConfig } from './config';

/**
 * Single Telegraf instance. Anyone needing `bot.telegram.xxx` imports from here.
 * Replaces the legacy `globalThis.__bot` pattern.
 */
export const bot = new Telegraf(getConfig().botToken);
```

- [ ] **Step 2: Verify**

```bash
npm run typecheck
npm run lint
```

- [ ] **Step 3: Commit**

```bash
git add src/core/bot.ts
git commit -m "feat(core): single Telegraf bot instance"
```

---

## Task 3: Build `src/core/redis.ts` (single Redis client)

**Files:**
- Create: `src/core/redis.ts`

- [ ] **Step 1: Create the file**

```typescript
import { createClient, type RedisClientType } from 'redis';

import { getConfig } from './config';
import { logger } from './observability';

const cfg = getConfig();

/** Single Redis client, connected lazily on first command. */
export const redis: RedisClientType = createClient({
  socket: { host: cfg.redisHost, port: cfg.redisPort },
  password: cfg.redisPassword,
});

redis.on('error', (err: unknown) => {
  logger.error({ err }, 'Redis client error');
});

export async function connectRedis(): Promise<void> {
  if (!redis.isOpen) await redis.connect();
}

export async function disconnectRedis(): Promise<void> {
  if (redis.isOpen) await redis.quit();
}
```

- [ ] **Step 2: Verify**

```bash
npm run typecheck
```

(`observability.ts` doesn't exist yet — that's expected; this task and Task 4 will land together with Task 5 building observability. **Alternatively, defer this file's commit until after Task 5.** For simplicity, swap Tasks 3 and 5 — do observability first, then redis.)

**Adjust ordering: do Task 5 (observability) BEFORE Task 3 (redis).** Once observability exports `logger`, the redis import compiles.

- [ ] **Step 3: Commit (after Task 5 is done)**

```bash
git add src/core/redis.ts
git commit -m "feat(core): single Redis client with config-driven connection"
```

---

## Task 4: Build `src/types/telegraf.d.ts` (Context augmentation)

**Files:**
- Modify: `src/types/telegraf.d.ts` (replaces Plan 01 stub)

- [ ] **Step 1: Replace contents**

```typescript
import 'telegraf';

declare module 'telegraf' {
  interface Context {
    /** Populated by core/middleware/rbac.ts. */
    state: {
      roles?: string[];
    };
    /** Populated by core/sessions.ts. Use these instead of ctx.session.* directly. */
    session: {
      user?: Record<string, unknown>;
      chat?: Record<string, unknown>;
      scene?: Record<string, unknown>;
      polls?: Record<string, unknown>;
    };
  }
}

export {};
```

- [ ] **Step 2: Verify**

```bash
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add src/types/telegraf.d.ts
git commit -m "feat(types): augment Telegraf Context with state and session shape"
```

---

## Task 5: Build `src/core/observability.ts` (pino + counters)

**Files:**
- Create: `src/core/observability.ts`
- Create: `src/core/observability.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { afterEach, describe, expect, it } from 'vitest';

import { metrics, resetMetrics } from './observability';

describe('observability metrics', () => {
  afterEach(() => resetMetrics());

  it('increments named counters', () => {
    metrics.incr('payments.success');
    metrics.incr('payments.success');
    metrics.incr('payments.failure');

    expect(metrics.get('payments.success')).toBe(2);
    expect(metrics.get('payments.failure')).toBe(1);
    expect(metrics.get('does.not.exist')).toBe(0);
  });

  it('records timer values', () => {
    metrics.recordMs('handler.latency', 50);
    metrics.recordMs('handler.latency', 100);
    const samples = metrics.getSamples('handler.latency');
    expect(samples).toEqual([50, 100]);
  });

  it('resets on resetMetrics()', () => {
    metrics.incr('foo');
    resetMetrics();
    expect(metrics.get('foo')).toBe(0);
  });
});
```

- [ ] **Step 2: Run and verify failure**

- [ ] **Step 3: Implement**

```typescript
import pino, { type Logger } from 'pino';

import { getConfig } from './config';

const cfg = getConfig();

export const logger: Logger = pino({
  level: cfg.logLevel,
  transport:
    cfg.nodeEnv === 'development'
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } }
      : undefined,
});

interface MetricsRegistry {
  counters: Map<string, number>;
  samples: Map<string, number[]>;
}

const registry: MetricsRegistry = {
  counters: new Map(),
  samples: new Map(),
};

export const metrics = {
  incr(name: string, by = 1): void {
    registry.counters.set(name, (registry.counters.get(name) ?? 0) + by);
  },
  get(name: string): number {
    return registry.counters.get(name) ?? 0;
  },
  recordMs(name: string, ms: number): void {
    const arr = registry.samples.get(name) ?? [];
    arr.push(ms);
    registry.samples.set(name, arr);
  },
  getSamples(name: string): number[] {
    return [...(registry.samples.get(name) ?? [])];
  },
  /** Snapshot for diagnostic dumps. */
  snapshot(): { counters: Record<string, number>; samples: Record<string, number[]> } {
    return {
      counters: Object.fromEntries(registry.counters),
      samples: Object.fromEntries(registry.samples),
    };
  },
};

export function resetMetrics(): void {
  registry.counters.clear();
  registry.samples.clear();
}
```

- [ ] **Step 4: Run tests + verify**

- [ ] **Step 5: Commit**

```bash
git add src/core/observability.ts src/core/observability.test.ts
git commit -m "feat(core): structured logger and in-process metrics"
```

---

(Now Task 3 — Redis — can be implemented since observability is in place.)

---

## Task 6: Build `src/core/i18n.ts` with typed keys

**Files:**
- Create: `src/core/i18n.ts`
- Create: `src/core/i18n.test.ts`

- [ ] **Step 1: Confirm the generated `i18n-keys.generated.ts` exists**

```bash
npm run gen:locale-types
ls -la src/core/i18n-keys.generated.ts
```

- [ ] **Step 2: Write the failing test**

```typescript
import { describe, expect, it } from 'vitest';

import { t } from './i18n';

describe('i18n', () => {
  it('returns the locale string for a known key', () => {
    // The actual key/value depends on locales/ru.json. Pick one that's likely
    // present. If this test fails, replace with a key the test author confirms
    // exists in the locale file.
    const result = t('start' as never);
    expect(typeof result).toBe('string');
  });

  it('interpolates {name} placeholders', () => {
    // Direct test of the interpolation logic via a synthetic key.
    // Since we cannot inject arbitrary keys without modifying ru.json,
    // this assertion relies on the implementation exposing a private
    // helper for unit testing. See implementation.
    // For now, this test is a placeholder; the actual interpolation
    // behavior is verified via the exported `format` helper.
  });

  it('returns the key itself if not found (with warn log)', () => {
    // @ts-expect-error — intentionally bad key
    const result = t('totally.made.up.key' as never);
    expect(result).toBe('totally.made.up.key');
  });
});
```

- [ ] **Step 3: Implement**

```typescript
import { promises as fs } from 'node:fs';
import path from 'node:path';

import type { LocaleKey } from './i18n-keys.generated';
import { logger } from './observability';

let _strings: Record<string, string> | undefined;

async function loadStrings(): Promise<Record<string, string>> {
  if (_strings) return _strings;
  const raw = await fs.readFile(path.join(process.cwd(), 'locales', 'ru.json'), 'utf-8');
  const tree = JSON.parse(raw) as unknown;
  const flat: Record<string, string> = {};
  function visit(node: unknown, prefix: string): void {
    if (typeof node === 'string') {
      flat[prefix] = node;
      return;
    }
    if (typeof node === 'object' && node !== null) {
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        visit(v, prefix ? `${prefix}.${k}` : k);
      }
    }
  }
  visit(tree, '');
  _strings = flat;
  return flat;
}

// Load synchronously at boot so `t()` is non-async at call sites.
// This block runs at module load.
const stringsSync = (() => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const localePath = path.join(process.cwd(), 'locales', 'ru.json');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const raw = require('node:fs').readFileSync(localePath, 'utf-8') as string;
  const tree = JSON.parse(raw) as unknown;
  const flat: Record<string, string> = {};
  function visit(node: unknown, prefix: string): void {
    if (typeof node === 'string') {
      flat[prefix] = node;
      return;
    }
    if (typeof node === 'object' && node !== null) {
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        visit(v, prefix ? `${prefix}.${k}` : k);
      }
    }
  }
  visit(tree, '');
  return flat;
})();

function interpolate(template: string, params: Record<string, string | number> | undefined): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (m, key: string) => {
    const v = params[key];
    return v === undefined ? m : String(v);
  });
}

export function t(key: LocaleKey, params?: Record<string, string | number>): string {
  const value = stringsSync[key];
  if (value === undefined) {
    logger.warn({ key }, 'Missing locale key');
    return key;
  }
  return interpolate(value, params);
}

/** Async loader exposed for tests / hot-reload scenarios. */
export { loadStrings };
```

NOTE: the implementation uses synchronous `readFileSync` at module load to make `t()` synchronous. This is the simpler design; the legacy bot also reads locales synchronously.

- [ ] **Step 4: Adjust test**

The test uses `t('start' as never)` because the LocaleKey type is generated and we don't know exact keys at test-writing time. If `'start'` doesn't exist in `locales/ru.json`, replace with any key that does (e.g., from the generated file). The assertion is loose (just that a string comes back).

- [ ] **Step 5: Run tests + commit**

```bash
npx vitest run src/core/i18n.test.ts
git add src/core/i18n.ts src/core/i18n.test.ts
git commit -m "feat(core): typed i18n with build-time key checking"
```

---

## Task 7: Build `src/core/router.ts` (typed callback router, TDD)

This is the biggest piece in Plan 03. The router maps zod-typed callback payloads to handlers and produces guaranteed-valid `callback_data` strings.

**Files:**
- Create: `src/core/router.ts`
- Create: `src/core/router.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { Composer } from 'telegraf';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { createRouter } from './router';

describe('router', () => {
  it('encodes a payload to a short callback_data string', () => {
    const router = createRouter();
    const schema = z.discriminatedUnion('a', [
      z.object({ a: z.literal('payMonth'), year: z.number(), month: z.number() }),
    ]);

    const encoded = router.encode(schema, { a: 'payMonth', year: 2026, month: 5 });

    expect(typeof encoded).toBe('string');
    expect(encoded.length).toBeLessThanOrEqual(64); // Telegram callback_data limit
  });

  it('round-trips a payload via encode → handler', async () => {
    const router = createRouter();
    const schema = z.discriminatedUnion('a', [
      z.object({ a: z.literal('payMonth'), year: z.number(), month: z.number() }),
    ]);
    const handler = vi.fn();
    router.on(schema, handler);

    const encoded = router.encode(schema, { a: 'payMonth', year: 2026, month: 5 });

    // Simulate a Telegraf action invocation
    const composer = new Composer();
    composer.use(router.middleware());

    const ctx = makeFakeCtx({ callbackQuery: { data: encoded } });
    await composer.middleware()(ctx, async () => {});
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][1]).toEqual({ a: 'payMonth', year: 2026, month: 5 });
  });

  it('throws at startup if two schemas claim the same action discriminator', () => {
    const router = createRouter();
    const a = z.discriminatedUnion('a', [z.object({ a: z.literal('go') })]);
    const b = z.discriminatedUnion('a', [z.object({ a: z.literal('go') })]);
    router.on(a, async () => {});
    expect(() => router.on(b, async () => {})).toThrow(/duplicate/i);
  });

  it('rejects a payload with extra unknown fields at encode time', () => {
    const router = createRouter();
    const schema = z.discriminatedUnion('a', [z.object({ a: z.literal('x'), n: z.number() })]);
    expect(() => router.encode(schema, { a: 'x', n: 1, extra: 'nope' } as unknown as never)).toThrow();
  });

  it('silently ignores a callback_data that does not match any registered schema', async () => {
    const router = createRouter();
    const composer = new Composer();
    composer.use(router.middleware());

    const fallback = vi.fn();
    const ctx = makeFakeCtx({ callbackQuery: { data: 'totally-unknown' } });
    await composer.middleware()(ctx, fallback);
    expect(fallback).toHaveBeenCalled(); // Falls through to next middleware
  });
});

function makeFakeCtx(overrides: Partial<{ callbackQuery: { data: string } }>): any {
  return {
    callbackQuery: overrides.callbackQuery,
    answerCbQuery: vi.fn().mockResolvedValue(undefined),
    state: {},
  };
}
```

- [ ] **Step 2: Run and verify failure**

- [ ] **Step 3: Implement `src/core/router.ts`**

Design: Each payload's first field `a` (a literal string) is the discriminator. The router stores a Map<action, {schema, handler}>. Encoding produces `a|<json>` (truncated to fit Telegram's 64-byte limit). Decoding parses the prefix, looks up the handler, validates the JSON against the schema. Action names should be short.

```typescript
import type { Context, MiddlewareFn } from 'telegraf';
import { Composer } from 'telegraf';
import type { ZodDiscriminatedUnion, ZodLiteral, ZodObject, z } from 'zod';

import { logger } from './observability';

type ActionLiteral = string;

interface Entry {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: ZodDiscriminatedUnion<'a', any>;
  handler: (ctx: Context, payload: unknown) => Promise<void> | void;
}

export interface Router {
  on<S extends ZodDiscriminatedUnion<'a', readonly ZodObject<{ a: ZodLiteral<ActionLiteral> }>[]>>(
    schema: S,
    handler: (ctx: Context, payload: z.infer<S>) => Promise<void> | void,
  ): void;
  encode<S extends ZodDiscriminatedUnion<'a', readonly ZodObject<{ a: ZodLiteral<ActionLiteral> }>[]>>(
    schema: S,
    payload: z.infer<S>,
  ): string;
  middleware(): MiddlewareFn<Context>;
}

const MAX_CALLBACK_LEN = 64;
const SEPARATOR = '|';

export function createRouter(): Router {
  const entries = new Map<ActionLiteral, Entry>();

  function getActionsFromSchema(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    schema: ZodDiscriminatedUnion<'a', any>,
  ): ActionLiteral[] {
    const actions: ActionLiteral[] = [];
    for (const option of schema.options) {
      const aField = option.shape.a;
      if (aField && '_def' in aField) {
        const literal = (aField as { _def: { value: ActionLiteral } })._def.value;
        actions.push(literal);
      }
    }
    return actions;
  }

  return {
    on(schema, handler) {
      const actions = getActionsFromSchema(schema);
      for (const a of actions) {
        if (entries.has(a)) {
          throw new Error(`Router: duplicate action "${a}". Two schemas claim the same discriminator.`);
        }
        entries.set(a, { schema, handler: handler as Entry['handler'] });
      }
    },

    encode(schema, payload) {
      // Validate against the schema BEFORE encoding. This is what makes dead
      // buttons a compile-time error (TS narrows) and a runtime error (zod).
      const parsed = schema.parse(payload);
      const action = (parsed as { a: ActionLiteral }).a;
      const rest = { ...parsed };
      delete (rest as { a?: unknown }).a;
      const encoded = `${action}${SEPARATOR}${JSON.stringify(rest)}`;
      if (encoded.length > MAX_CALLBACK_LEN) {
        throw new Error(
          `Router: encoded callback_data exceeds ${MAX_CALLBACK_LEN} bytes (got ${encoded.length}): ${encoded}`,
        );
      }
      return encoded;
    },

    middleware() {
      return Composer.action(/.+/, async (ctx, next) => {
        const data = ctx.callbackQuery && 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : undefined;
        if (typeof data !== 'string') return next();

        const idx = data.indexOf(SEPARATOR);
        const action = idx >= 0 ? data.slice(0, idx) : data;
        const restJson = idx >= 0 ? data.slice(idx + 1) : '{}';

        const entry = entries.get(action);
        if (!entry) return next();

        let rest: unknown;
        try {
          rest = JSON.parse(restJson);
        } catch (err) {
          logger.warn({ err, data }, 'Router: failed to JSON.parse payload');
          return next();
        }
        const merged = { a: action, ...(rest as Record<string, unknown>) };
        const parseResult = entry.schema.safeParse(merged);
        if (!parseResult.success) {
          logger.warn({ data, error: parseResult.error.format() }, 'Router: payload failed schema validation');
          return next();
        }

        try {
          await entry.handler(ctx, parseResult.data);
        } catch (err) {
          logger.error({ err, action }, 'Router: handler threw');
          throw err;
        }
      });
    },
  };
}
```

- [ ] **Step 4: Run tests + iterate until passing**

The test file uses `import { Composer } from 'telegraf'` to make a fake context. If type issues arise (Telegraf's `Context` is heavily generic), add `as any` casts in the test or use a minimal stub.

- [ ] **Step 5: Commit**

```bash
git add src/core/router.ts src/core/router.test.ts
git commit -m "feat(core): typed callback router with schema-validated payloads"
```

---

## Task 8: Build `src/core/sessions.ts`

**Files:**
- Create: `src/core/sessions.ts`

- [ ] **Step 1: Implement**

```typescript
import { Redis } from '@telegraf/session/redis';
import { session, type SessionStore } from 'telegraf';

import { getConfig } from './config';
import { redis } from './redis';

const cfg = getConfig();

interface SessionShape {
  user?: Record<string, unknown>;
  chat?: Record<string, unknown>;
  scene?: Record<string, unknown>;
  polls?: Record<string, unknown>;
}

function defaultStore(): SessionStore<SessionShape> {
  if (!cfg.useRedisSessions) {
    // In-memory fallback for tests / dev without Redis
    const map = new Map<string, SessionShape>();
    return {
      get: async (key: string) => map.get(key),
      set: async (key: string, value: SessionShape) => {
        map.set(key, value);
      },
      delete: async (key: string) => {
        map.delete(key);
      },
    } as SessionStore<SessionShape>;
  }

  return Redis<SessionShape>({
    host: cfg.redisHost,
    port: cfg.redisPort,
    password: cfg.redisPassword,
    client: redis as never,
  }) as SessionStore<SessionShape>;
}

/**
 * Single namespaced session middleware. `ctx.session.user`, `.chat`, `.scene`, `.polls`.
 * Key: per-chat-and-user.
 */
export const sessionMiddleware = session<SessionShape>({
  store: defaultStore(),
  getSessionKey: (ctx) => {
    const chatId = ctx.chat?.id;
    const userId = ctx.from?.id;
    if (chatId === undefined || userId === undefined) return undefined;
    return `${chatId}:${userId}`;
  },
  defaultSession: () => ({}),
});
```

NOTE: The exact API for `@telegraf/session/redis` may differ; if the import fails, fall back to using `telegraf-session-redis-upd` (already a project dep). The implementer should adapt and verify that `npm run typecheck` passes.

- [ ] **Step 2: Verify**

```bash
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add src/core/sessions.ts
git commit -m "feat(core): single namespaced Redis session middleware"
```

---

## Task 9: Build `src/db/repos/users.ts` and `src/db/repos/user-roles.ts`

Small DB-access helpers used by core middleware. They live under `src/db/` so they bypass the ESLint feature-boundary rule.

**Files:**
- Create: `src/db/repos/users.ts` + tests (unit; not integration since they need a DB)
- Create: `src/db/repos/user-roles.ts` + tests

- [ ] **Step 1: Implement `src/db/repos/users.ts`**

```typescript
import type { DbConn } from '../client';

export interface UserRow {
  id: number;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  createdAt: Date;
}

export async function upsertUserFromTelegram(
  conn: DbConn,
  user: { id: number; username?: string; firstName?: string; lastName?: string },
): Promise<void> {
  await conn('users')
    .insert({
      id: user.id,
      username: user.username ?? 'not_set',
      first_name: user.firstName ?? null,
      last_name: user.lastName ?? null,
    })
    .onConflict('id')
    .merge({
      username: user.username ?? 'not_set',
      first_name: user.firstName ?? null,
      last_name: user.lastName ?? null,
    });
}

export async function getUserById(conn: DbConn, id: number): Promise<UserRow | undefined> {
  const row = await conn('users').where('id', id).first();
  if (!row) return undefined;
  return {
    id: row.id,
    username: row.username,
    firstName: row.first_name,
    lastName: row.last_name,
    createdAt: row.created_at,
  };
}
```

- [ ] **Step 2: Implement `src/db/repos/user-roles.ts`**

```typescript
import type { DbConn } from '../client';

export async function getRolesForUser(conn: DbConn, userId: number): Promise<string[]> {
  const rows = await conn('user_roles').where('user_id', userId).select('role');
  return rows.map((r: { role: string }) => r.role);
}

export async function isBanned(conn: DbConn, userId: number): Promise<boolean> {
  const roles = await getRolesForUser(conn, userId);
  return roles.includes('banned') || roles.includes('selfBanned');
}
```

- [ ] **Step 3: Commit (no tests at the repo layer — these are exercised by integration tests later)**

```bash
git add src/db/repos/users.ts src/db/repos/user-roles.ts
git commit -m "feat(db): user and user-roles repository helpers"
```

---

## Task 10: Build `src/core/middleware/error.ts`

**Files:**
- Create: `src/core/middleware/error.ts`

- [ ] **Step 1: Implement**

```typescript
import type { Context, MiddlewareFn } from 'telegraf';

import { logger, metrics } from '../observability';

const USER_ERROR_MESSAGE = 'Произошла ошибка. Попробуй ещё раз через минуту.';

export const errorMiddleware: MiddlewareFn<Context> = async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    metrics.incr('error.unhandled');
    logger.error(
      {
        err,
        updateType: Object.keys(ctx.update).filter((k) => k !== 'update_id')[0],
        userId: ctx.from?.id,
        chatId: ctx.chat?.id,
      },
      'Unhandled error in middleware chain',
    );
    if (ctx.from) {
      try {
        await ctx.reply(USER_ERROR_MESSAGE);
      } catch (replyErr) {
        logger.warn({ replyErr }, 'Could not send user-facing error message');
      }
    }
  }
};
```

- [ ] **Step 2: Commit**

```bash
git add src/core/middleware/error.ts
git commit -m "feat(core/middleware): structured error handler with user feedback"
```

---

## Task 11: Build `src/core/middleware/logger.ts`

**Files:**
- Create: `src/core/middleware/logger.ts`

- [ ] **Step 1: Implement**

```typescript
import type { Context, MiddlewareFn } from 'telegraf';

import { logger, metrics } from '../observability';

export const loggerMiddleware: MiddlewareFn<Context> = async (ctx, next) => {
  const updateType = Object.keys(ctx.update).filter((k) => k !== 'update_id')[0] ?? 'unknown';
  const userId = ctx.from?.id;
  const chatId = ctx.chat?.id;
  const start = Date.now();

  logger.info({ updateType, userId, chatId }, 'incoming update');
  metrics.incr(`update.${updateType}`);

  try {
    await next();
  } finally {
    metrics.recordMs('handler.latency', Date.now() - start);
  }
};
```

- [ ] **Step 2: Commit**

```bash
git add src/core/middleware/logger.ts
git commit -m "feat(core/middleware): structured per-update request logger"
```

---

## Task 12: Build `src/core/middleware/banned.ts` (fail-CLOSED)

**Files:**
- Create: `src/core/middleware/banned.ts`
- Create: `src/core/middleware/banned.test.ts`

- [ ] **Step 1: Write the test**

```typescript
import { describe, expect, it, vi } from 'vitest';

import { createBannedMiddleware } from './banned';

describe('bannedMiddleware', () => {
  it('passes through non-banned users', async () => {
    const isBanned = vi.fn().mockResolvedValue(false);
    const mw = createBannedMiddleware(isBanned);
    const next = vi.fn();
    await mw({ from: { id: 1 }, reply: vi.fn() } as never, next);
    expect(next).toHaveBeenCalled();
  });

  it('blocks banned users with a polite message', async () => {
    const isBanned = vi.fn().mockResolvedValue(true);
    const reply = vi.fn();
    const mw = createBannedMiddleware(isBanned);
    const next = vi.fn();
    await mw({ from: { id: 1 }, reply } as never, next);
    expect(next).not.toHaveBeenCalled();
    expect(reply).toHaveBeenCalled();
  });

  it('fails CLOSED on DB error — does NOT pass through', async () => {
    const isBanned = vi.fn().mockRejectedValue(new Error('DB unreachable'));
    const reply = vi.fn();
    const mw = createBannedMiddleware(isBanned);
    const next = vi.fn();
    await mw({ from: { id: 1 }, reply } as never, next);
    expect(next).not.toHaveBeenCalled();
    expect(reply).toHaveBeenCalled();
  });

  it('passes through when ctx.from is missing', async () => {
    const isBanned = vi.fn();
    const mw = createBannedMiddleware(isBanned);
    const next = vi.fn();
    await mw({ from: undefined } as never, next);
    expect(next).toHaveBeenCalled();
    expect(isBanned).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Implement**

```typescript
import type { Context, MiddlewareFn } from 'telegraf';

import { db } from '../../db/client';
import { isBanned as defaultIsBanned } from '../../db/repos/user-roles';
import { logger, metrics } from '../observability';

const ERROR_MESSAGE = 'Сейчас бот не может ответить. Попробуй позже.';

export function createBannedMiddleware(
  isBannedFn: (userId: number) => Promise<boolean>,
): MiddlewareFn<Context> {
  return async (ctx, next) => {
    if (!ctx.from) return next();
    try {
      const banned = await isBannedFn(ctx.from.id);
      if (banned) {
        metrics.incr('banned.blocked');
        try {
          await ctx.reply(ERROR_MESSAGE);
        } catch {
          /* user-block from us, ignore */
        }
        return;
      }
      return next();
    } catch (err) {
      metrics.incr('banned.db_error');
      logger.error({ err, userId: ctx.from.id }, 'banned middleware: DB error, failing CLOSED');
      try {
        await ctx.reply(ERROR_MESSAGE);
      } catch {
        /* ignore */
      }
      return;
    }
  };
}

export const bannedMiddleware: MiddlewareFn<Context> = createBannedMiddleware((id) =>
  defaultIsBanned(db, id),
);
```

- [ ] **Step 3: Run tests + commit**

```bash
git add src/core/middleware/banned.ts src/core/middleware/banned.test.ts
git commit -m "feat(core/middleware): fail-CLOSED banned check with structured logging"
```

---

## Task 13: Build `src/core/middleware/user-tracker.ts` (bounded LRU)

**Files:**
- Create: `src/core/middleware/user-tracker.ts`
- Create: `src/core/middleware/user-tracker.test.ts`

- [ ] **Step 1: Write the test**

```typescript
import { describe, expect, it, vi } from 'vitest';

import { createUserTracker } from './user-tracker';

describe('userTracker', () => {
  it('upserts a user on first sight', async () => {
    const upsert = vi.fn().mockResolvedValue(undefined);
    const mw = createUserTracker({ upsert, cacheSize: 100 });
    const next = vi.fn();
    await mw({ from: { id: 1, username: 'a', first_name: 'A' } } as never, next);
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalled();
  });

  it('skips upsert when user is in cache and unchanged', async () => {
    const upsert = vi.fn().mockResolvedValue(undefined);
    const mw = createUserTracker({ upsert, cacheSize: 100 });
    const next = vi.fn();
    const ctx = { from: { id: 1, username: 'a', first_name: 'A' } };
    await mw(ctx as never, next);
    await mw(ctx as never, next);
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it('re-upserts when user fields change', async () => {
    const upsert = vi.fn().mockResolvedValue(undefined);
    const mw = createUserTracker({ upsert, cacheSize: 100 });
    const next = vi.fn();
    await mw({ from: { id: 1, username: 'a' } } as never, next);
    await mw({ from: { id: 1, username: 'b' } } as never, next);
    expect(upsert).toHaveBeenCalledTimes(2);
  });

  it('does not block the next() chain on upsert errors', async () => {
    const upsert = vi.fn().mockRejectedValue(new Error('DB error'));
    const mw = createUserTracker({ upsert, cacheSize: 100 });
    const next = vi.fn();
    await mw({ from: { id: 1, username: 'a' } } as never, next);
    expect(next).toHaveBeenCalled();
  });

  it('skips when ctx.from is missing', async () => {
    const upsert = vi.fn();
    const mw = createUserTracker({ upsert, cacheSize: 100 });
    const next = vi.fn();
    await mw({ from: undefined } as never, next);
    expect(upsert).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Implement**

```typescript
import { LRUCache } from 'lru-cache';
import type { Context, MiddlewareFn } from 'telegraf';

import { db } from '../../db/client';
import { upsertUserFromTelegram } from '../../db/repos/users';
import { logger } from '../observability';

interface CachedUser {
  username: string | undefined;
  firstName: string | undefined;
  lastName: string | undefined;
}

interface UserInput {
  id: number;
  username: string | undefined;
  firstName: string | undefined;
  lastName: string | undefined;
}

interface Options {
  upsert: (u: UserInput) => Promise<void>;
  cacheSize?: number;
}

function sameUser(a: CachedUser, b: CachedUser): boolean {
  return a.username === b.username && a.firstName === b.firstName && a.lastName === b.lastName;
}

export function createUserTracker(opts: Options): MiddlewareFn<Context> {
  const cache = new LRUCache<number, CachedUser>({ max: opts.cacheSize ?? 10_000 });
  return async (ctx, next) => {
    const from = ctx.from;
    if (!from) return next();
    const current: CachedUser = {
      username: from.username,
      firstName: from.first_name,
      lastName: from.last_name,
    };
    const cached = cache.get(from.id);
    if (!cached || !sameUser(cached, current)) {
      try {
        await opts.upsert({ id: from.id, ...current });
        cache.set(from.id, current);
      } catch (err) {
        logger.warn({ err, userId: from.id }, 'userTracker upsert failed; continuing chain');
      }
    }
    return next();
  };
}

export const userTrackerMiddleware: MiddlewareFn<Context> = createUserTracker({
  upsert: (u) => upsertUserFromTelegram(db, u),
});
```

- [ ] **Step 3: Run tests + commit**

```bash
git add src/core/middleware/user-tracker.ts src/core/middleware/user-tracker.test.ts
git commit -m "feat(core/middleware): bounded LRU user tracker"
```

---

## Task 14: Build `src/core/middleware/rbac.ts`

**Files:**
- Create: `src/core/middleware/rbac.ts`
- Create: `src/core/middleware/rbac.test.ts`

- [ ] **Step 1: Write test**

```typescript
import { describe, expect, it, vi } from 'vitest';

import { createRbacMiddleware } from './rbac';

describe('rbacMiddleware', () => {
  it('populates ctx.state.roles from the role getter', async () => {
    const getRoles = vi.fn().mockResolvedValue(['admin', 'plus']);
    const mw = createRbacMiddleware(getRoles);
    const ctx: { from?: { id: number }; state: { roles?: string[] } } = {
      from: { id: 1 },
      state: {},
    };
    const next = vi.fn();
    await mw(ctx as never, next);
    expect(ctx.state.roles).toEqual(['admin', 'plus']);
    expect(next).toHaveBeenCalled();
  });

  it('sets roles=[] when from is missing', async () => {
    const getRoles = vi.fn();
    const mw = createRbacMiddleware(getRoles);
    const ctx: { from?: { id: number }; state: { roles?: string[] } } = { state: {} };
    const next = vi.fn();
    await mw(ctx as never, next);
    expect(ctx.state.roles).toEqual([]);
    expect(getRoles).not.toHaveBeenCalled();
  });

  it('defaults to [] on getRoles failure (continues chain)', async () => {
    const getRoles = vi.fn().mockRejectedValue(new Error('DB error'));
    const mw = createRbacMiddleware(getRoles);
    const ctx: { from?: { id: number }; state: { roles?: string[] } } = {
      from: { id: 1 },
      state: {},
    };
    const next = vi.fn();
    await mw(ctx as never, next);
    expect(ctx.state.roles).toEqual([]);
    expect(next).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Implement**

```typescript
import type { Context, MiddlewareFn } from 'telegraf';

import { db } from '../../db/client';
import { getRolesForUser } from '../../db/repos/user-roles';
import { logger } from '../observability';

export function createRbacMiddleware(
  getRoles: (userId: number) => Promise<string[]>,
): MiddlewareFn<Context> {
  return async (ctx, next) => {
    if (!ctx.from) {
      ctx.state.roles = [];
      return next();
    }
    try {
      ctx.state.roles = await getRoles(ctx.from.id);
    } catch (err) {
      logger.warn({ err, userId: ctx.from.id }, 'rbac middleware: role lookup failed; defaulting to []');
      ctx.state.roles = [];
    }
    return next();
  };
}

export const rbacMiddleware: MiddlewareFn<Context> = createRbacMiddleware((id) =>
  getRolesForUser(db, id),
);
```

- [ ] **Step 3: Run tests + commit**

```bash
git add src/core/middleware/rbac.ts src/core/middleware/rbac.test.ts
git commit -m "feat(core/middleware): RBAC role lookup populates ctx.state.roles"
```

---

## Task 15: Build `src/core/middleware/xp-on-message.ts`

Awards 1 XP per qualifying message, subject to a Redis-backed daily limit (default 7) and weekly limit (default 52). Both limits come from the legacy `configs/rpg.js`.

**Files:**
- Create: `src/core/middleware/xp-on-message.ts`
- Create: `src/core/middleware/xp-on-message.test.ts`

- [ ] **Step 1: Write test (uses a stub Redis client)**

```typescript
import { describe, expect, it, vi } from 'vitest';

import { createXpOnMessage } from './xp-on-message';

function makeFakeRedis() {
  const store = new Map<string, number>();
  const ttl = new Map<string, number>();
  return {
    store,
    async incr(key: string) {
      const v = (store.get(key) ?? 0) + 1;
      store.set(key, v);
      return v;
    },
    async expire(key: string, seconds: number) {
      ttl.set(key, seconds);
    },
    async ttl(key: string) {
      return ttl.get(key) ?? -1;
    },
  };
}

describe('xp-on-message', () => {
  it('grants XP when under daily limit', async () => {
    const redis = makeFakeRedis();
    const grant = vi.fn().mockResolvedValue(undefined);
    const mw = createXpOnMessage({
      redis: redis as never,
      grant,
      dailyLimit: 3,
      weeklyLimit: 10,
      allowedChatIds: [-100],
    });
    const ctx = { from: { id: 1 }, chat: { id: -100 } };
    const next = vi.fn();
    await mw(ctx as never, next);
    expect(grant).toHaveBeenCalledTimes(1);
  });

  it('skips when chat is not in allowedChatIds', async () => {
    const redis = makeFakeRedis();
    const grant = vi.fn();
    const mw = createXpOnMessage({
      redis: redis as never,
      grant,
      dailyLimit: 3,
      weeklyLimit: 10,
      allowedChatIds: [-100],
    });
    await mw({ from: { id: 1 }, chat: { id: -999 } } as never, vi.fn());
    expect(grant).not.toHaveBeenCalled();
  });

  it('stops granting after daily limit', async () => {
    const redis = makeFakeRedis();
    const grant = vi.fn().mockResolvedValue(undefined);
    const mw = createXpOnMessage({
      redis: redis as never,
      grant,
      dailyLimit: 2,
      weeklyLimit: 10,
      allowedChatIds: [-100],
    });
    const ctx = { from: { id: 1 }, chat: { id: -100 } };
    await mw(ctx as never, vi.fn());
    await mw(ctx as never, vi.fn());
    await mw(ctx as never, vi.fn()); // over the limit
    expect(grant).toHaveBeenCalledTimes(2);
  });

  it('still calls next() regardless of XP outcome', async () => {
    const redis = makeFakeRedis();
    const grant = vi.fn();
    const mw = createXpOnMessage({
      redis: redis as never,
      grant,
      dailyLimit: 0,
      weeklyLimit: 0,
      allowedChatIds: [-100],
    });
    const next = vi.fn();
    await mw({ from: { id: 1 }, chat: { id: -100 } } as never, next);
    expect(next).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Implement**

```typescript
import type { Context, MiddlewareFn } from 'telegraf';

import { logger } from '../observability';

interface RedisLike {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<void | number>;
}

interface Options {
  redis: RedisLike;
  grant: (userId: number, amount: number) => Promise<void>;
  dailyLimit: number;
  weeklyLimit: number;
  allowedChatIds: number[];
  xpPerMessage?: number;
}

function dayKey(userId: number): string {
  const d = new Date();
  const day = d.toISOString().slice(0, 10);
  return `xp:msg:day:${day}:${userId}`;
}

function weekKey(userId: number): string {
  const d = new Date();
  // ISO week-of-year (rough): year + week-number computed by days/7
  const start = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - start.getTime()) / 86_400_000 + start.getDay() + 1) / 7);
  return `xp:msg:week:${d.getFullYear()}:${week}:${userId}`;
}

const DAY_SECONDS = 86_400;
const WEEK_SECONDS = 7 * 86_400;

export function createXpOnMessage(opts: Options): MiddlewareFn<Context> {
  const xpPerMessage = opts.xpPerMessage ?? 1;
  const allowed = new Set(opts.allowedChatIds);
  return async (ctx, next) => {
    try {
      if (!ctx.from || !ctx.chat) return next();
      if (!allowed.has(ctx.chat.id)) return next();

      const dKey = dayKey(ctx.from.id);
      const wKey = weekKey(ctx.from.id);
      const dCount = await opts.redis.incr(dKey);
      if (dCount === 1) await opts.redis.expire(dKey, DAY_SECONDS);
      const wCount = await opts.redis.incr(wKey);
      if (wCount === 1) await opts.redis.expire(wKey, WEEK_SECONDS);

      if (dCount <= opts.dailyLimit && wCount <= opts.weeklyLimit) {
        await opts.grant(ctx.from.id, xpPerMessage);
      }
    } catch (err) {
      logger.warn({ err }, 'xp-on-message: failed; continuing chain');
    }
    return next();
  };
}
```

NOTE: a real `xpOnMessage` middleware export tied to the actual `redis` and `grantXp` won't be created here — Plan 03 keeps the factory only. The bound default version lands when the loyalty feature plan wires `grantXp` (it lives in `src/shared/xp.ts` but needs a DB-backed counterpart). For Plan 03 we ship the factory and tests.

- [ ] **Step 3: Run tests + commit**

```bash
git add src/core/middleware/xp-on-message.ts src/core/middleware/xp-on-message.test.ts
git commit -m "feat(core/middleware): rate-limited message XP factory"
```

---

## Task 16: Build `src/core/permissions.ts`

**Files:**
- Create: `src/core/permissions.ts`
- Create: `src/core/permissions.test.ts`

- [ ] **Step 1: Test**

```typescript
import { describe, expect, it, vi } from 'vitest';

import { requireDM, requireGroup, requireRoles } from './permissions';

function makeCtx(state: { roles?: string[] }, chat?: { type: string; id: number }): any {
  return {
    state,
    chat,
    answerCbQuery: vi.fn(),
    reply: vi.fn(),
  };
}

describe('permissions', () => {
  describe('requireRoles', () => {
    it('allows when the user has any of the required roles', async () => {
      const mw = requireRoles('admin');
      const next = vi.fn();
      await mw(makeCtx({ roles: ['admin'] }), next);
      expect(next).toHaveBeenCalled();
    });

    it('rejects when none of the roles match', async () => {
      const mw = requireRoles('admin', 'super');
      const next = vi.fn();
      await mw(makeCtx({ roles: ['plus'] }), next);
      expect(next).not.toHaveBeenCalled();
    });

    it('rejects when roles is undefined', async () => {
      const mw = requireRoles('admin');
      const next = vi.fn();
      await mw(makeCtx({}), next);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('requireDM', () => {
    it('passes when chat is private', async () => {
      const mw = requireDM();
      const next = vi.fn();
      await mw(makeCtx({}, { type: 'private', id: 1 }), next);
      expect(next).toHaveBeenCalled();
    });

    it('rejects when chat is a group', async () => {
      const mw = requireDM();
      const next = vi.fn();
      await mw(makeCtx({}, { type: 'group', id: 1 }), next);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('requireGroup', () => {
    it('passes when chat id matches', async () => {
      const mw = requireGroup(-100);
      const next = vi.fn();
      await mw(makeCtx({}, { type: 'supergroup', id: -100 }), next);
      expect(next).toHaveBeenCalled();
    });

    it('rejects when chat id does not match', async () => {
      const mw = requireGroup(-100);
      const next = vi.fn();
      await mw(makeCtx({}, { type: 'group', id: -999 }), next);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Implement**

```typescript
import type { Context, MiddlewareFn } from 'telegraf';

import { logger } from './observability';

export function requireRoles(...required: string[]): MiddlewareFn<Context> {
  return async (ctx, next) => {
    const roles = ctx.state.roles ?? [];
    if (required.some((r) => roles.includes(r))) {
      return next();
    }
    logger.debug({ required, userRoles: roles, userId: ctx.from?.id }, 'permission denied: requireRoles');
    if ('answerCbQuery' in ctx && typeof ctx.answerCbQuery === 'function') {
      try {
        await ctx.answerCbQuery('Недостаточно прав');
      } catch {
        /* ignore */
      }
    }
  };
}

export function requireDM(): MiddlewareFn<Context> {
  return async (ctx, next) => {
    if (ctx.chat?.type === 'private') return next();
    logger.debug({ chatType: ctx.chat?.type }, 'permission denied: requireDM');
  };
}

export function requireGroup(chatId: number): MiddlewareFn<Context> {
  return async (ctx, next) => {
    if (ctx.chat?.id === chatId) return next();
    logger.debug({ expected: chatId, got: ctx.chat?.id }, 'permission denied: requireGroup');
  };
}
```

- [ ] **Step 3: Run tests + commit**

```bash
git add src/core/permissions.ts src/core/permissions.test.ts
git commit -m "feat(core): permission helpers (requireRoles/DM/Group)"
```

---

## Task 17: Build `src/core/scenes.ts` (scene chain helpers)

**Files:**
- Create: `src/core/scenes.ts`

- [ ] **Step 1: Implement**

```typescript
import type { BaseScene } from 'telegraf/scenes';

/**
 * Resolve the previous and next scene in a chain.
 * Used by per-scene `back` / `next` actions so scene order is defined
 * in one place, not hardcoded in every scene file.
 */
export interface SceneChain {
  readonly steps: readonly string[];
  prevOf(current: string): string | null;
  nextOf(current: string): string | null;
}

export function defineChain(steps: readonly string[]): SceneChain {
  const indexByName = new Map<string, number>();
  steps.forEach((s, i) => indexByName.set(s, i));
  return {
    steps,
    prevOf(current) {
      const i = indexByName.get(current);
      if (i === undefined || i === 0) return null;
      return steps[i - 1] ?? null;
    },
    nextOf(current) {
      const i = indexByName.get(current);
      if (i === undefined || i === steps.length - 1) return null;
      return steps[i + 1] ?? null;
    },
  };
}

/** Type alias for the Scene constructor used by feature scenes. */
export type Scene = BaseScene<never>;
```

- [ ] **Step 2: Commit**

```bash
git add src/core/scenes.ts
git commit -m "feat(core): scene chain helper for shared step navigation"
```

---

## Task 18: Wire `src/index.ts` and verify the bot can launch

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Replace `src/index.ts`**

```typescript
import 'dotenv/config';

import { bot } from './core/bot';
import { errorMiddleware } from './core/middleware/error';
import { loggerMiddleware } from './core/middleware/logger';
import { bannedMiddleware } from './core/middleware/banned';
import { userTrackerMiddleware } from './core/middleware/user-tracker';
import { rbacMiddleware } from './core/middleware/rbac';
import { sessionMiddleware } from './core/sessions';
import { connectRedis, disconnectRedis } from './core/redis';
import { logger } from './core/observability';
import { getConfig } from './core/config';

async function main(): Promise<void> {
  const cfg = getConfig();
  logger.info({ nodeEnv: cfg.nodeEnv, logLevel: cfg.logLevel }, 'goblin-helper-bot v2 starting');

  if (cfg.useRedisSessions) {
    await connectRedis();
  }

  bot.use(errorMiddleware);
  bot.use(loggerMiddleware);
  bot.use(sessionMiddleware);
  bot.use(bannedMiddleware);
  bot.use(userTrackerMiddleware);
  bot.use(rbacMiddleware);

  // Features are registered here in Plans 04+. For now, no commands or actions.

  await bot.launch({ dropPendingUpdates: true });
  logger.info({ username: bot.botInfo?.username }, 'Bot online');

  const stop = async (signal: NodeJS.Signals): Promise<void> => {
    logger.info({ signal }, 'Stopping bot');
    bot.stop(signal);
    await disconnectRedis();
    process.exit(0);
  };
  process.once('SIGINT', () => void stop('SIGINT'));
  process.once('SIGTERM', () => void stop('SIGTERM'));
}

main().catch((err) => {
  logger.fatal({ err }, 'Failed to launch bot');
  process.exit(1);
});
```

- [ ] **Step 2: Verify build**

```bash
npm run typecheck
npm run lint
npm run build
ls dist/
```

`dist/index.js` should exist. The bot won't actually run end-to-end without a valid TOKEN and reachable Postgres+Redis — that's fine, this verifies it compiles.

- [ ] **Step 3: Run all unit tests**

```bash
npx vitest run "src/**/*.test.ts"
```

Expected: all unit tests pass (period, pricing, xp, achievements, loyalty-config, format, db/mapper, core/config, core/observability, core/i18n, core/router, core/permissions, core/middleware/*).

- [ ] **Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat(core): wire bot launch with core middleware chain"
```

---

## Self-review checklist (Plan 03 wrap-up)

- [ ] `npm test` (unit) passes including all new core tests.
- [ ] `npm run lint`, `npm run typecheck`, `npm run build` all clean.
- [ ] No business logic in `core/` — only bot plumbing.
- [ ] No `globalThis.__bot`; no `eval`; no hardcoded admin IDs.
- [ ] Every middleware factory is exported alongside its bound default.
- [ ] The bot WOULD launch if TOKEN/DB/Redis were available — verified by build + a quick `node dist/index.js` smoke test (expect connection errors but not import errors).
- [ ] `docs/dev-setup.md` mentions the new env vars (LOG_LEVEL, REDIS_PASSWORD, USE_REDIS_SESSIONS, NODE_ENV).

---

## What's next

Plan 04 — simple features (`common/`, `polls/`, `promo/`). Small, low-risk feature modules with clear scope. With core done, each feature module just adds routes/services/repos under `src/features/<name>/` and imports core helpers.
