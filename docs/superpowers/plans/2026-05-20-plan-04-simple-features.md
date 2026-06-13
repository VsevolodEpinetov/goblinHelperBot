# Plan 04 — Simple Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement three small, low-risk feature modules — `src/features/common/`, `src/features/polls/`, `src/features/promo/` — using the core platform from Plan 03 (typed router, permissions, session, observability, i18n).

**Architecture:** Each feature follows the standard folder shape from the spec: `index.ts` (public register fn), `routes.ts` (router wiring), `service.ts` (business logic), `repo.ts` (DB), `schemas.ts` (zod for callback payloads). Pure logic gets unit tests; DB-touching logic gets integration tests written but not run end-to-end (matching Plan 02's mode — user has no local Postgres yet).

**Tech Stack:** TypeScript, Telegraf v4, zod (already wired), knex (via repos), Vitest.

**Spec reference:** `docs/superpowers/specs/2026-05-17-bot-greenfield-rewrite-design.md` §4.6, §4.7, §4.8, §4.10.

**Prerequisites:** Plans 01, 02, 03 complete. The bot in `src/index.ts` boots with core middleware but no feature handlers yet.

**Out of scope:**
- Subscriptions, payments, raids, kickstarters, loyalty, admin (later plans).
- End-to-end testing against a real Postgres.

---

## File Structure

**Created (`src/features/common/`):**
- `index.ts`, `routes.ts`, `schemas.ts`, `service.ts` + `service.test.ts`

**Created (`src/features/polls/`):**
- `index.ts`, `routes.ts`, `admin-routes.ts`, `schemas.ts`, `service.ts` + `service.test.ts`, `repo.ts`, `constants.ts`, `menus.ts`

**Created (`src/features/promo/`):**
- `index.ts`, `routes.ts`, `service.ts` + `service.test.ts`, `repo.ts`, `schemas.ts`

**Created (integration tests, written but not runnable without DB):**
- `tests/integration/polls.repo.test.ts`
- `tests/integration/promo.repo.test.ts`

**Modified:**
- `src/index.ts` — register the three features
- `src/core/router.ts` — expose a singleton router so features share one (see Task 1)

---

## Task 1: Promote the router to a process-wide singleton

**Files:**
- Modify: `src/core/router.ts`

The Plan 03 router exports `createRouter()` (factory). For features to share a single router (so the boot-time duplicate-action check works across all features), we need one process-wide instance. Add this without breaking the existing test.

- [ ] **Step 1: Add a singleton export at the bottom of `src/core/router.ts`**

```typescript
/** Process-wide router. Feature modules call `router.on(...)` to register. */
export const router: Router = createRouter();
```

- [ ] **Step 2: Verify the existing router test still passes** (it uses `createRouter()` directly and is unaffected)

```bash
npx vitest run src/core/router.test.ts
```

- [ ] **Step 3: Commit**

```bash
git add src/core/router.ts
git commit -m "feat(core/router): expose a process-wide singleton"
```

---

## Task 2: `src/features/common/` — /id, /roll, /info, deleteThisMessage

**Files:**
- Create: `src/features/common/schemas.ts`
- Create: `src/features/common/service.ts` + `src/features/common/service.test.ts`
- Create: `src/features/common/routes.ts`
- Create: `src/features/common/index.ts`

### Step 1: Write the service test (`service.test.ts`)

```typescript
import { describe, expect, it } from 'vitest';

import { rollDice } from './service';

describe('common.service.rollDice', () => {
  it('returns an integer between 1 and max (inclusive) for valid input', () => {
    for (let i = 0; i < 100; i += 1) {
      const result = rollDice(6);
      expect(Number.isInteger(result)).toBe(true);
      expect(result).toBeGreaterThanOrEqual(1);
      expect(result).toBeLessThanOrEqual(6);
    }
  });

  it('returns 1 when max is 1', () => {
    expect(rollDice(1)).toBe(1);
  });

  it('throws on max < 1', () => {
    expect(() => rollDice(0)).toThrow();
    expect(() => rollDice(-5)).toThrow();
  });

  it('throws on non-integer max', () => {
    expect(() => rollDice(2.5)).toThrow();
  });

  it('caps max at a sane upper bound', () => {
    expect(() => rollDice(1_000_001)).toThrow(/maximum/i);
  });
});
```

### Step 2: Run failure

```bash
npx vitest run src/features/common/service.test.ts
```

### Step 3: Implement `src/features/common/service.ts`

```typescript
const MAX_DICE = 1_000_000;

export function rollDice(max: number): number {
  if (!Number.isInteger(max)) throw new Error('max must be an integer');
  if (max < 1) throw new Error('max must be >= 1');
  if (max > MAX_DICE) throw new Error(`max exceeds maximum (${MAX_DICE})`);
  return Math.floor(Math.random() * max) + 1;
}
```

### Step 4: Implement `src/features/common/schemas.ts`

```typescript
import { z } from 'zod';

export const commonCallback = z.discriminatedUnion('a', [z.object({ a: z.literal('del') })]);
```

### Step 5: Implement `src/features/common/routes.ts`

```typescript
import type { Telegraf } from 'telegraf';

import { router } from '../../core/router';
import { logger } from '../../core/observability';

import { commonCallback } from './schemas';
import { rollDice } from './service';

export function register(bot: Telegraf): void {
  bot.command('id', async (ctx) => {
    if (!ctx.from || !ctx.chat) return;
    await ctx.reply(`Твой telegram ID: ${ctx.from.id}\nЧат: ${ctx.chat.id}`);
  });

  bot.hears(/^\/roll(?:\s+(\d+))?\s*$/, async (ctx) => {
    const raw = ctx.match[1];
    const max = raw ? Number(raw) : 6;
    try {
      const result = rollDice(max);
      await ctx.reply(String(result), {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        reply_parameters: { message_id: ctx.message.message_id } as any,
      });
    } catch (err) {
      logger.debug({ err, max }, 'rollDice rejected input');
      await ctx.reply('Использование: /roll <число от 1 до 1000000>');
    }
  });

  bot.command('info', async (ctx) => {
    if (!ctx.from) return;
    const roles = ctx.state.roles ?? [];
    await ctx.reply(
      [
        `<b>Твоя информация</b>`,
        `ID: <code>${ctx.from.id}</code>`,
        `Роли: ${roles.length === 0 ? '—' : roles.join(', ')}`,
      ].join('\n'),
      { parse_mode: 'HTML' },
    );
  });

  // Generic "delete this message" button used by other features.
  router.on(commonCallback, async (ctx) => {
    try {
      await ctx.deleteMessage();
    } catch (err) {
      logger.debug({ err }, 'deleteThisMessage failed');
    }
  });
}

/** Helper for menus to encode the delete-button callback. */
export function deleteThisMessageButton(): string {
  return router.encode(commonCallback, { a: 'del' });
}
```

### Step 6: Implement `src/features/common/index.ts`

```typescript
export { register, deleteThisMessageButton } from './routes';
```

### Step 7: Run tests + verify

```bash
npx vitest run src/features/common
npm run typecheck
npm run lint
```

### Step 8: Commit

```bash
git add src/features/common/
git commit -m "feat(features/common): /id, /roll, /info, deleteThisMessage button"
```

---

## Task 3: `src/features/polls/constants.ts` and `src/features/polls/repo.ts`

**Files:**
- Create: `src/features/polls/constants.ts`
- Create: `src/features/polls/repo.ts`

### Step 1: Implement `src/features/polls/constants.ts`

```typescript
export const POLLS_ROLES = ['polls', 'adminPolls', 'admin', 'adminPlus', 'super'] as const;

export type PollsRole = (typeof POLLS_ROLES)[number];
```

### Step 2: Implement `src/features/polls/repo.ts`

Based on legacy migrations 012 + 013, the tables are:
- `polls_core_studios` (id, name, created_at)
- `polls_studios` (id, name, added_at)

```typescript
import type { DbConn } from '../../db/client';

export interface StudioRow {
  id: number;
  name: string;
}

/** Result of attempting to add a studio: `'added'` or `'duplicate'`. */
export type AddStudioResult = 'added' | 'duplicate';

const UNIQUE_VIOLATION = '23505';

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === UNIQUE_VIOLATION
  );
}

export async function addCoreStudio(conn: DbConn, name: string): Promise<AddStudioResult> {
  try {
    await conn('polls_core_studios').insert({ name });
    return 'added';
  } catch (err) {
    if (isUniqueViolation(err)) return 'duplicate';
    throw err;
  }
}

export async function addDynamicStudio(conn: DbConn, name: string): Promise<AddStudioResult> {
  try {
    await conn('polls_studios').insert({ name });
    return 'added';
  } catch (err) {
    if (isUniqueViolation(err)) return 'duplicate';
    throw err;
  }
}

export async function listCoreStudios(conn: DbConn): Promise<StudioRow[]> {
  return conn('polls_core_studios').orderBy('name', 'asc').select('id', 'name');
}

export async function listDynamicStudios(conn: DbConn): Promise<StudioRow[]> {
  return conn('polls_studios').orderBy('added_at', 'asc').select('id', 'name');
}

export async function resetCoreStudios(conn: DbConn): Promise<number> {
  return conn('polls_core_studios').delete();
}

export async function resetDynamicStudios(conn: DbConn): Promise<number> {
  return conn('polls_studios').delete();
}
```

### Step 3: Verify

```bash
npm run typecheck
npm run lint
```

### Step 4: Commit

```bash
git add src/features/polls/constants.ts src/features/polls/repo.ts
git commit -m "feat(features/polls): constants and repository"
```

---

## Task 4: `src/features/polls/service.ts` (parsing + Telegram-poll counting, TDD)

**Files:**
- Create: `src/features/polls/service.ts`
- Create: `src/features/polls/service.test.ts`

### Step 1: Write test

```typescript
import { describe, expect, it } from 'vitest';

import { parseStudioName, summarizePoll } from './service';

describe('polls.service.parseStudioName', () => {
  it('returns the trimmed first non-link non-price line', () => {
    expect(parseStudioName('Studio A\nhttps://example.com\n$100')).toBe('Studio A');
  });

  it('skips lines starting with http', () => {
    expect(parseStudioName('http://x\nReal Studio')).toBe('Real Studio');
  });

  it('skips lines starting with $ or €', () => {
    expect(parseStudioName('$50\n€60\nWith Name')).toBe('With Name');
  });

  it('trims whitespace', () => {
    expect(parseStudioName('   Studio B   ')).toBe('Studio B');
  });

  it('returns undefined if no valid line is found', () => {
    expect(parseStudioName('http://only\n$only')).toBeUndefined();
  });
});

describe('polls.service.summarizePoll', () => {
  it('formats a HTML summary with percentages', () => {
    const result = summarizePoll(
      {
        question: 'Best studio?',
        total_voter_count: 10,
        options: [
          { text: 'Studio A - some descr', voter_count: 5 },
          { text: 'Studio B - other', voter_count: 3 },
          { text: 'Пустой вариант', voter_count: 2 }, // should be skipped
        ],
      },
      /* totalChatMembers */ 10,
    );
    expect(result).toContain('Best studio?');
    expect(result).toContain('Studio A');
    expect(result).toContain('Studio B');
    expect(result).not.toContain('Пустой вариант');
    expect(result).toContain('%');
  });

  it('shows the not-voted line only when there are pending voters', () => {
    const result = summarizePoll(
      { question: 'q', total_voter_count: 4, options: [] },
      10,
    );
    expect(result).toContain('Ждём ещё 6');
  });

  it('omits the not-voted line when everyone voted', () => {
    const result = summarizePoll(
      { question: 'q', total_voter_count: 10, options: [] },
      10,
    );
    expect(result).not.toContain('Ждём');
  });
});
```

### Step 2: Run failure, then implement `src/features/polls/service.ts`

```typescript
export function parseStudioName(text: string): string | undefined {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (line.startsWith('http')) continue;
    if (line.startsWith('$') || line.startsWith('€')) continue;
    return line;
  }
  return undefined;
}

export interface PollLike {
  question: string;
  total_voter_count: number;
  options: ReadonlyArray<{ text: string; voter_count: number }>;
}

export function summarizePoll(poll: PollLike, totalChatMembers: number): string {
  const totalCount = Math.max(1, totalChatMembers); // avoid division-by-zero
  const lines: string[] = [];
  lines.push(`📝 Результаты <b>${poll.question}</b>`);
  lines.push('');
  lines.push(`<i>Всего проголосовало: ${poll.total_voter_count}</i>`);

  const notVoted = totalChatMembers - poll.total_voter_count;
  if (notVoted > 0) {
    lines.push(`<i>Ждём ещё ${notVoted} участников</i>`);
  }

  for (const opt of poll.options) {
    if (opt.text === 'Пустой вариант') continue;
    const percent = Math.ceil((opt.voter_count / totalCount) * 100);
    const label = opt.text.split(' - ')[0];
    lines.push('');
    lines.push(`${label} - ${percent}%`);
  }

  return lines.join('\n');
}
```

### Step 3: Run tests + commit

```bash
npx vitest run src/features/polls/service.test.ts
git add src/features/polls/service.ts src/features/polls/service.test.ts
git commit -m "feat(features/polls): pure service (studio name parser, poll summarizer)"
```

---

## Task 5: `src/features/polls/menus.ts` and `src/features/polls/schemas.ts`

**Files:**
- Create: `src/features/polls/schemas.ts`
- Create: `src/features/polls/menus.ts`

### Step 1: `schemas.ts`

```typescript
import { z } from 'zod';

export const pollsCallback = z.discriminatedUnion('a', [
  z.object({ a: z.literal('polCoreList') }),
  z.object({ a: z.literal('polDynList') }),
  z.object({ a: z.literal('polCoreReset') }),
  z.object({ a: z.literal('polDynReset') }),
]);
```

### Step 2: `menus.ts`

```typescript
import { Markup } from 'telegraf';

import { router } from '../../core/router';

import { pollsCallback } from './schemas';

export function adminMenu(): ReturnType<typeof Markup.inlineKeyboard> {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('Core list', router.encode(pollsCallback, { a: 'polCoreList' })),
      Markup.button.callback('Reset core', router.encode(pollsCallback, { a: 'polCoreReset' })),
    ],
    [
      Markup.button.callback('Dynamic list', router.encode(pollsCallback, { a: 'polDynList' })),
      Markup.button.callback('Reset dynamic', router.encode(pollsCallback, { a: 'polDynReset' })),
    ],
  ]);
}
```

### Step 3: Verify + commit

```bash
npm run typecheck
git add src/features/polls/schemas.ts src/features/polls/menus.ts
git commit -m "feat(features/polls): admin menu and callback schemas"
```

---

## Task 6: `src/features/polls/routes.ts` and `admin-routes.ts`

**Files:**
- Create: `src/features/polls/routes.ts`
- Create: `src/features/polls/admin-routes.ts`
- Create: `src/features/polls/index.ts`

### Step 1: `routes.ts` (user-facing)

```typescript
import type { Telegraf } from 'telegraf';

import { db } from '../../db/client';
import { logger } from '../../core/observability';
import { requireRoles } from '../../core/permissions';

import { POLLS_ROLES } from './constants';
import { addCoreStudio, addDynamicStudio } from './repo';
import { parseStudioName, summarizePoll } from './service';

async function ephemeralReply(ctx: { reply: (s: string) => Promise<{ message_id: number }>; deleteMessage: (id?: number) => Promise<void> }, text: string, ms = 5000): Promise<void> {
  const sent = await ctx.reply(text);
  setTimeout(() => {
    ctx.deleteMessage(sent.message_id).catch(() => undefined);
  }, ms);
}

export function registerUserRoutes(bot: Telegraf): void {
  bot.command('add', requireRoles(...POLLS_ROLES), async (ctx) => {
    const name = parseStudioName(ctx.message.text.replace(/^\/add\s*/i, ''));
    if (!name) {
      await ephemeralReply(ctx, 'Не вижу название студии. Пример: /add Foo Studio');
      return;
    }
    const result = await addCoreStudio(db, name);
    await ephemeralReply(
      ctx,
      result === 'added' ? `Added ${name} to core studios` : `Studio ${name} already exists in core studios`,
    );
  });

  bot.hears('+', requireRoles(...POLLS_ROLES), async (ctx) => {
    const reply = ctx.message.reply_to_message;
    if (!reply) return;
    const raw = ('text' in reply ? reply.text : undefined) ?? ('caption' in reply ? reply.caption : undefined);
    if (!raw) return;
    const name = parseStudioName(raw);
    if (!name) return;
    const result = await addDynamicStudio(db, name);
    await ephemeralReply(
      ctx,
      result === 'added' ? `Added ${name} to polls` : `Studio ${name} already exists in polls`,
    );
  });

  bot.command('count', requireRoles(...POLLS_ROLES), async (ctx) => {
    const reply = ctx.message.reply_to_message;
    if (!reply) {
      await ctx.reply('Ты промахнулся');
      return;
    }
    if (!('poll' in reply) || !reply.poll) {
      await ctx.reply('Промах');
      return;
    }
    let totalMembers = 0;
    try {
      totalMembers = (await ctx.getChatMembersCount()) - 1;
    } catch (err) {
      logger.warn({ err }, 'count: getChatMembersCount failed');
      await ctx.reply('Не удалось получить количество участников');
      return;
    }
    const text = summarizePoll(reply.poll, totalMembers);
    await ctx.reply(text, { parse_mode: 'HTML' });
  });
}
```

### Step 2: `admin-routes.ts`

```typescript
import { router } from '../../core/router';
import { db } from '../../db/client';
import { requireRoles } from '../../core/permissions';
import type { Telegraf } from 'telegraf';

import { POLLS_ROLES } from './constants';
import { listCoreStudios, listDynamicStudios, resetCoreStudios, resetDynamicStudios } from './repo';
import { adminMenu } from './menus';
import { pollsCallback } from './schemas';

function rolesGuard(): ReturnType<typeof requireRoles> {
  return requireRoles(...POLLS_ROLES);
}

export function registerAdminRoutes(bot: Telegraf): void {
  bot.command('polls', rolesGuard(), async (ctx) => {
    await ctx.reply('Polls admin:', adminMenu());
  });

  router.on(pollsCallback, async (ctx, payload) => {
    // Role guard: read from ctx.state.roles (populated by rbac middleware)
    const roles = ctx.state.roles ?? [];
    if (!POLLS_ROLES.some((r) => roles.includes(r))) {
      await ctx.answerCbQuery?.('Недостаточно прав');
      return;
    }

    switch (payload.a) {
      case 'polCoreList': {
        const rows = await listCoreStudios(db);
        const body = rows.length === 0 ? 'Core list is empty' : rows.map((r) => `• ${r.name}`).join('\n');
        await ctx.editMessageText(body);
        break;
      }
      case 'polDynList': {
        const rows = await listDynamicStudios(db);
        const body = rows.length === 0 ? 'Dynamic list is empty' : rows.map((r) => `• ${r.name}`).join('\n');
        await ctx.editMessageText(body);
        break;
      }
      case 'polCoreReset': {
        const n = await resetCoreStudios(db);
        await ctx.editMessageText(`Core list cleared (${n} rows)`);
        break;
      }
      case 'polDynReset': {
        const n = await resetDynamicStudios(db);
        await ctx.editMessageText(`Dynamic list cleared (${n} rows)`);
        break;
      }
    }
    await ctx.answerCbQuery?.();
  });
}
```

### Step 3: `index.ts`

```typescript
import type { Telegraf } from 'telegraf';

import { registerAdminRoutes } from './admin-routes';
import { registerUserRoutes } from './routes';

export function register(bot: Telegraf): void {
  registerUserRoutes(bot);
  registerAdminRoutes(bot);
}
```

### Step 4: Run typecheck + lint + commit

```bash
npm run typecheck
npm run lint
git add src/features/polls/
git commit -m "feat(features/polls): user commands, admin menu, and routes"
```

If `ctx.match[1]` complains about types, cast: `(ctx.match[1] as string | undefined)`. If `editMessageText` complains, accept the wider Telegraf union type.

---

## Task 7: `src/features/polls/` integration test

**Files:**
- Create: `tests/integration/polls.repo.test.ts`

### Step 1: Implement

```typescript
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Knex } from 'knex';

import { addCoreStudio, addDynamicStudio, listCoreStudios, listDynamicStudios, resetCoreStudios, resetDynamicStudios } from '../../src/features/polls/repo';
import { setupTestDb } from './setup';

describe('polls.repo', () => {
  let db: Knex;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    ({ db, cleanup } = await setupTestDb());
    await db.migrate.latest();
  });

  afterEach(async () => {
    await cleanup();
  });

  it('addCoreStudio returns "added" then "duplicate"', async () => {
    expect(await addCoreStudio(db, 'Studio A')).toBe('added');
    expect(await addCoreStudio(db, 'Studio A')).toBe('duplicate');
  });

  it('addDynamicStudio behaves the same', async () => {
    expect(await addDynamicStudio(db, 'Dyn A')).toBe('added');
    expect(await addDynamicStudio(db, 'Dyn A')).toBe('duplicate');
  });

  it('lists are ordered as expected', async () => {
    await addCoreStudio(db, 'B');
    await addCoreStudio(db, 'A');
    const core = await listCoreStudios(db);
    expect(core.map((r) => r.name)).toEqual(['A', 'B']);

    await addDynamicStudio(db, 'X');
    await addDynamicStudio(db, 'Y');
    const dyn = await listDynamicStudios(db);
    expect(dyn.map((r) => r.name)).toEqual(['X', 'Y']);
  });

  it('reset deletes all rows', async () => {
    await addCoreStudio(db, 'A');
    await addDynamicStudio(db, 'B');
    expect(await resetCoreStudios(db)).toBeGreaterThanOrEqual(1);
    expect(await resetDynamicStudios(db)).toBeGreaterThanOrEqual(1);
    expect(await listCoreStudios(db)).toEqual([]);
    expect(await listDynamicStudios(db)).toEqual([]);
  });
});
```

### Step 2: Attempt run (will fail ECONNREFUSED)

```bash
npx vitest run tests/integration/polls.repo.test.ts 2>&1 | head -10
```

### Step 3: Commit

```bash
git add tests/integration/polls.repo.test.ts
git commit -m "test(integration): polls repo round-trip"
```

---

## Task 8: `src/features/promo/repo.ts` and `src/features/promo/schemas.ts`

**Files:**
- Create: `src/features/promo/schemas.ts`
- Create: `src/features/promo/repo.ts`

### Step 1: `schemas.ts`

```typescript
import { z } from 'zod';

export const promoCallback = z.discriminatedUnion('a', [z.object({ a: z.literal('promoGet') })]);
```

### Step 2: `repo.ts`

Tables (snake_case already):
- `promo_files` (id, file_id unique, file_type, file_name, file_size, uploaded_at, uploaded_by, is_active)
- `user_promo_usage` (id, user_id, promo_file_id, used_at, cooldown_until)

```typescript
import type { DbConn } from '../../db/client';

export interface PromoFileRow {
  id: number;
  file_id: string;
  file_type: 'photo' | 'video' | 'document' | 'animation' | 'sticker';
  file_name: string | null;
  file_size: number | null;
}

/** Returns a random active promo file the user has not used while still on cooldown. */
export async function pickPromoFileForUser(
  conn: DbConn,
  userId: number,
): Promise<PromoFileRow | undefined> {
  return conn('promo_files as p')
    .select('p.id', 'p.file_id', 'p.file_type', 'p.file_name', 'p.file_size')
    .where('p.is_active', true)
    .whereNotIn('p.id', function () {
      this.select('u.promo_file_id')
        .from('user_promo_usage as u')
        .where('u.user_id', userId)
        .andWhere('u.cooldown_until', '>', conn.fn.now());
    })
    .orderByRaw('random()')
    .first();
}

export async function getActiveCooldown(
  conn: DbConn,
  userId: number,
): Promise<Date | undefined> {
  const row = await conn('user_promo_usage')
    .where('user_id', userId)
    .andWhere('cooldown_until', '>', conn.fn.now())
    .orderBy('cooldown_until', 'desc')
    .first();
  return row?.cooldown_until;
}

export async function recordPromoUsage(
  conn: DbConn,
  userId: number,
  promoFileId: number,
  cooldownUntil: Date,
): Promise<void> {
  await conn('user_promo_usage').insert({
    user_id: userId,
    promo_file_id: promoFileId,
    cooldown_until: cooldownUntil,
  });
}

export async function addPromoFile(
  conn: DbConn,
  fileId: string,
  fileType: PromoFileRow['file_type'],
  fileName: string | null,
  fileSize: number | null,
  uploadedBy: number,
): Promise<number> {
  const [row] = await conn('promo_files')
    .insert({
      file_id: fileId,
      file_type: fileType,
      file_name: fileName,
      file_size: fileSize,
      uploaded_by: uploadedBy,
    })
    .returning('id');
  return row.id;
}
```

### Step 3: Commit

```bash
npm run typecheck
git add src/features/promo/repo.ts src/features/promo/schemas.ts
git commit -m "feat(features/promo): repository and callback schema"
```

---

## Task 9: `src/features/promo/service.ts` (TDD)

**Files:**
- Create: `src/features/promo/service.ts`
- Create: `src/features/promo/service.test.ts`

### Step 1: Test

```typescript
import { describe, expect, it } from 'vitest';

import { formatTimeRemaining, computeCooldownUntil, COOLDOWN_HOURS } from './service';

describe('promo.service.formatTimeRemaining', () => {
  it('formats hours and minutes', () => {
    const future = new Date(Date.now() + (2 * 60 + 30) * 60_000);
    expect(formatTimeRemaining(future)).toBe('2ч 30м');
  });

  it('formats minutes only when under an hour', () => {
    const future = new Date(Date.now() + 45 * 60_000);
    expect(formatTimeRemaining(future)).toBe('45м');
  });

  it('returns "0 минут" when already past', () => {
    const past = new Date(Date.now() - 1000);
    expect(formatTimeRemaining(past)).toBe('0 минут');
  });
});

describe('promo.service.computeCooldownUntil', () => {
  it('is exactly COOLDOWN_HOURS in the future', () => {
    const now = new Date(2026, 4, 17, 12, 0, 0);
    const until = computeCooldownUntil(now);
    expect(until.getTime() - now.getTime()).toBe(COOLDOWN_HOURS * 3600_000);
  });
});
```

### Step 2: Implement

```typescript
export const COOLDOWN_HOURS = 6;

export function computeCooldownUntil(now: Date = new Date()): Date {
  return new Date(now.getTime() + COOLDOWN_HOURS * 3600_000);
}

export function formatTimeRemaining(until: Date, now: Date = new Date()): string {
  const diff = until.getTime() - now.getTime();
  if (diff <= 0) return '0 минут';
  const hours = Math.floor(diff / 3600_000);
  const minutes = Math.floor((diff % 3600_000) / 60_000);
  return hours > 0 ? `${hours}ч ${minutes}м` : `${minutes}м`;
}
```

### Step 3: Run + commit

```bash
npx vitest run src/features/promo/service.test.ts
git add src/features/promo/service.ts src/features/promo/service.test.ts
git commit -m "feat(features/promo): cooldown helpers (pure logic)"
```

---

## Task 10: `src/features/promo/routes.ts` and `index.ts`

**Files:**
- Create: `src/features/promo/routes.ts`
- Create: `src/features/promo/index.ts`

### Step 1: `routes.ts`

```typescript
import type { Telegraf } from 'telegraf';

import { db } from '../../db/client';
import { logger } from '../../core/observability';
import { router } from '../../core/router';

import { getActiveCooldown, pickPromoFileForUser, recordPromoUsage } from './repo';
import { promoCallback } from './schemas';
import { computeCooldownUntil, formatTimeRemaining } from './service';

const NO_PROMOS = 'Сейчас нет доступных промо. Попробуй позже.';

export function register(bot: Telegraf): void {
  router.on(promoCallback, async (ctx) => {
    if (!ctx.from) {
      await ctx.answerCbQuery?.();
      return;
    }
    try {
      const cooldown = await getActiveCooldown(db, ctx.from.id);
      if (cooldown) {
        await ctx.answerCbQuery?.(`На кулдауне ещё ${formatTimeRemaining(cooldown)}`, { show_alert: true });
        return;
      }
      const file = await pickPromoFileForUser(db, ctx.from.id);
      if (!file) {
        await ctx.answerCbQuery?.(NO_PROMOS, { show_alert: true });
        return;
      }
      await recordPromoUsage(db, ctx.from.id, file.id, computeCooldownUntil());
      await ctx.answerCbQuery?.();
      switch (file.file_type) {
        case 'photo':
          await ctx.replyWithPhoto(file.file_id);
          break;
        case 'video':
          await ctx.replyWithVideo(file.file_id);
          break;
        case 'document':
          await ctx.replyWithDocument(file.file_id);
          break;
        case 'animation':
          await ctx.replyWithAnimation(file.file_id);
          break;
        case 'sticker':
          await ctx.replyWithSticker(file.file_id);
          break;
      }
    } catch (err) {
      logger.error({ err }, 'promo: delivery failed');
      await ctx.answerCbQuery?.('Что-то сломалось. Попробуй позже.', { show_alert: true });
    }
  });
}
```

### Step 2: `index.ts`

```typescript
import type { Telegraf } from 'telegraf';

import { register as registerRoutes } from './routes';
export { promoCallback } from './schemas';

export function register(bot: Telegraf): void {
  registerRoutes(bot);
}
```

### Step 3: Commit

```bash
npm run typecheck
npm run lint
git add src/features/promo/routes.ts src/features/promo/index.ts
git commit -m "feat(features/promo): delivery route with cooldown enforcement"
```

---

## Task 11: `tests/integration/promo.repo.test.ts`

**Files:**
- Create: `tests/integration/promo.repo.test.ts`

### Step 1: Implement

```typescript
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Knex } from 'knex';

import {
  addPromoFile,
  getActiveCooldown,
  pickPromoFileForUser,
  recordPromoUsage,
} from '../../src/features/promo/repo';
import { computeCooldownUntil } from '../../src/features/promo/service';
import { setupTestDb } from './setup';

describe('promo.repo', () => {
  let db: Knex;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    ({ db, cleanup } = await setupTestDb());
    await db.migrate.latest();
  });

  afterEach(async () => {
    await cleanup();
  });

  it('pickPromoFileForUser returns one of the active files, then null when all on cooldown', async () => {
    await db('users').insert({ id: 1, username: 'u1' });
    const id1 = await addPromoFile(db, 'fid1', 'photo', 'a.jpg', 100, 999);
    const id2 = await addPromoFile(db, 'fid2', 'photo', 'b.jpg', 100, 999);

    const first = await pickPromoFileForUser(db, 1);
    expect(first).toBeDefined();
    await recordPromoUsage(db, 1, first!.id, computeCooldownUntil());

    const second = await pickPromoFileForUser(db, 1);
    expect(second).toBeDefined();
    expect(second!.id).not.toBe(first!.id);
    await recordPromoUsage(db, 1, second!.id, computeCooldownUntil());

    const exhausted = await pickPromoFileForUser(db, 1);
    expect(exhausted).toBeUndefined();
    void id1;
    void id2;
  });

  it('getActiveCooldown returns the latest active cooldown', async () => {
    await db('users').insert({ id: 1, username: 'u1' });
    const id = await addPromoFile(db, 'fid', 'photo', null, null, 999);
    await recordPromoUsage(db, 1, id, computeCooldownUntil());

    const cd = await getActiveCooldown(db, 1);
    expect(cd).toBeDefined();
    expect(cd!.getTime()).toBeGreaterThan(Date.now());
  });

  it('getActiveCooldown returns undefined when no cooldown is active', async () => {
    await db('users').insert({ id: 1, username: 'u1' });
    expect(await getActiveCooldown(db, 1)).toBeUndefined();
  });
});
```

### Step 2: Commit (test will fail ECONNREFUSED — expected)

```bash
git add tests/integration/promo.repo.test.ts
git commit -m "test(integration): promo repo round-trip"
```

---

## Task 12: Wire features into `src/index.ts`

**Files:**
- Modify: `src/index.ts`

### Step 1: Add feature registration calls

Insert after the existing middleware block, before `bot.launch()`:

```typescript
import * as commonFeature from './features/common';
import * as pollsFeature from './features/polls';
import * as promoFeature from './features/promo';

// ...inside main(), after middleware registration, before bot.launch:
commonFeature.register(bot);
pollsFeature.register(bot);
promoFeature.register(bot);
```

Also: the router middleware must be installed (so callback queries actually dispatch). Add it to the chain. The order matters: error → logger → session → banned → user-tracker → rbac → ROUTER → other handlers.

```typescript
import { router } from './core/router';
// ...
bot.use(router.middleware());
```

Place `bot.use(router.middleware());` AFTER the `rbacMiddleware` line so callback handlers can read `ctx.state.roles`.

### Step 2: Full pipeline verification

```bash
npm run gen:locale-types
npm run lint
npm run typecheck
npx vitest run "src/**/*.test.ts"
npm run build
```

All green. `dist/index.js` exists.

### Step 3: Commit

```bash
git add src/index.ts
git commit -m "feat(core): register common, polls, promo features"
```

---

## Self-review checklist (Plan 04 wrap-up)

- [ ] All three feature folders match the per-feature shape (`index.ts`, `routes.ts`, `service.ts`, `repo.ts`, `schemas.ts`, optionally `menus.ts` and `admin-routes.ts`).
- [ ] No feature imports another feature's internals (only `index.ts` of sibling features).
- [ ] All `repo.ts` files are the only place knex is imported in `src/features/*`.
- [ ] Unit tests pass (rollDice, parseStudioName, summarizePoll, formatTimeRemaining, computeCooldownUntil).
- [ ] Integration tests are written but expected to fail with ECONNREFUSED.
- [ ] Full pipeline (lint, typecheck, unit tests, build) green.
- [ ] `src/index.ts` registers the three features and uses the router middleware.

---

## What's next

Plan 05 — Loyalty unification (`features/loyalty/`, `features/scrolls/`, `features/achievements/`). Single XP source, single tier source, idempotent achievement grants — the cleanup of the dual loyalty system the audit found.
