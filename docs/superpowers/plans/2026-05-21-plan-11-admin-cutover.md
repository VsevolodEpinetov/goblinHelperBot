# Plan 11 — Admin Tooling + Cutover Prep

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the minimum-viable admin surface for the rewrite, delete the legacy JavaScript codebase, and document the single-go cutover.

**Architecture:** `features/admin/` covers the must-have admin operations: user search, role/scroll/achievement grants, manual payment confirm, monthly chat setup. Less-frequent operations (e.g. promo file upload via bot, bulk operations, kickstarter price audit) stay as SQL/scripts; the bot doesn't have to expose every legacy action. After the admin feature lands, the legacy `modules/`, `index.js`, `pg.js`, and assorted docs/examples files are deleted. A cutover runbook documents the production switchover.

**Tech Stack:** TypeScript, Telegraf v4, knex, Vitest, zod.

**Spec reference:** §4.11 of `docs/superpowers/specs/2026-05-17-bot-greenfield-rewrite-design.md` plus §7 (rollout). Onboarding-admin (paginated application review + approve/reject) already landed in Plan 09; payments-admin (SBP confirm/reject) in Plan 08; polls-admin in Plan 04. Plan 11 fills the remaining gaps.

**Prerequisites:** Plans 01–10 complete. Decision-makers know that this plan ends with `npm run migrate` against production followed by `npm run start:new`. The user has stated they accept the single-go cutover risk.

**Out of scope:**
- The remaining 30+ niche legacy admin actions. Listed at the bottom of this plan; can be added later as needed.
- Promo file admin upload via bot (still works via direct DB or a script).

---

## File Structure

**Created (`src/features/admin/`):**
- `repo.ts`
- `service.ts` + `service.test.ts`
- `schemas.ts`
- `menus.ts`
- `routes.ts`
- `actions.ts`
- `months-actions.ts` (new month / set chat)
- `index.ts`

**Created (`src/features/admin/scenes/`):**
- `grant-scroll.ts`, `grant-role.ts`, `change-balance.ts`, `set-month-chat.ts`

**Modified:**
- `src/index.ts` — register admin feature
- `package.json` — swap `start` to point at the new bot
- `docs/dev-setup.md` — update commands; remove legacy section

**Created (docs):**
- `docs/superpowers/runbooks/cutover.md` — the single-go cutover runbook

**Deleted (legacy):**
- `index.js`, `indexf.js`, `INTEGRATION_EXAMPLES.js`, `update.sh`
- `modules/` (entire directory tree)
- `configs/` (entire directory — replaced by `src/shared/loyalty-config.ts` + env)
- `MIGRATION_GUIDE.md`, `RPG_OVERHAUL.md`, `RPG_DELIVERY_SUMMARY.md`, `RPG_QUICK_REFERENCE.md`, `DATABASE_SCHEMA.md` (moved to `docs/legacy/` for archive)

---

## Task 1: `src/features/admin/repo.ts`

**Files:**
- Create: `src/features/admin/repo.ts`

### Step 1: Implement

```typescript
import type { DbConn } from '../../db/client';

export interface UserSearchResult {
  id: number;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  createdAt: Date;
}

/** Search by exact id, exact @username, or username substring. */
export async function searchUsers(conn: DbConn, query: string, limit = 20): Promise<UserSearchResult[]> {
  const trimmed = query.trim().replace(/^@/, '');
  let q = conn('users').orderBy('created_at', 'desc').limit(limit);
  const asId = Number(trimmed);
  if (!Number.isNaN(asId) && trimmed === String(asId)) {
    q = q.where('id', asId);
  } else {
    q = q.where('username', 'ilike', `%${trimmed}%`);
  }
  const rows = await q;
  return rows.map((r: Record<string, unknown>) => ({
    id: r.id as number,
    username: (r.username as string | null) ?? null,
    firstName: (r.first_name as string | null) ?? null,
    lastName: (r.last_name as string | null) ?? null,
    createdAt: r.created_at as Date,
  }));
}

export async function getUserBalance(conn: DbConn, userId: number): Promise<number> {
  const row = await conn('user_purchases').where('user_id', userId).first();
  return row ? Number(row.balance) : 0;
}

export async function setUserBalance(conn: DbConn, userId: number, balance: number): Promise<void> {
  await conn('user_purchases')
    .insert({ user_id: userId, balance })
    .onConflict('user_id')
    .merge({ balance });
}

export interface MonthSummary {
  id: number;
  period: string;
  type: string;
  chatId: string | null;
  counterJoined: number;
  counterPaid: number;
}

export async function listMonths(conn: DbConn, limit = 30): Promise<MonthSummary[]> {
  const rows = await conn('months').orderBy('period', 'desc').limit(limit);
  return rows.map((r: Record<string, unknown>) => ({
    id: r.id as number,
    period: r.period as string,
    type: r.type as string,
    chatId: (r.chat_id as string | null) ?? null,
    counterJoined: (r.counter_joined as number) ?? 0,
    counterPaid: (r.counter_paid as number) ?? 0,
  }));
}

export async function insertMonth(
  conn: DbConn,
  period: string,
  type: 'regular' | 'plus',
  chatId: string | null,
): Promise<void> {
  await conn('months')
    .insert({ period, type, chat_id: chatId, counter_joined: 0, counter_paid: 0 })
    .onConflict(['period', 'type'])
    .merge({ chat_id: chatId });
}

export async function updateMonthChatId(
  conn: DbConn,
  period: string,
  type: 'regular' | 'plus',
  chatId: string,
): Promise<void> {
  await conn('months').where({ period, type }).update({ chat_id: chatId });
}
```

### Step 2: Commit

```bash
mkdir -p src/features/admin
# write repo.ts
npm run typecheck
git add src/features/admin/repo.ts
git commit -m "feat(features/admin): repository (users search + months CRUD)"
```

---

## Task 2: `src/features/admin/service.ts` (TDD where pure)

**Files:**
- Create: `src/features/admin/service.ts`
- Create: `src/features/admin/service.test.ts`

### Step 1: Test (pure validators only)

```typescript
import { describe, expect, it } from 'vitest';

import { parseUserQuery, parseBalanceInput, parsePeriodKey } from './service';

describe('admin.service.parseUserQuery', () => {
  it('strips leading @ and trims', () => {
    expect(parseUserQuery('  @alice  ')).toBe('alice');
  });
  it('returns id-shaped numeric strings as-is', () => {
    expect(parseUserQuery('12345')).toBe('12345');
  });
  it('rejects empty', () => {
    expect(() => parseUserQuery('')).toThrow();
  });
});

describe('admin.service.parseBalanceInput', () => {
  it('parses integer balances', () => {
    expect(parseBalanceInput('1500')).toBe(1500);
  });
  it('parses negative balances (for deductions)', () => {
    expect(parseBalanceInput('-50')).toBe(-50);
  });
  it('throws on non-numeric', () => {
    expect(() => parseBalanceInput('abc')).toThrow();
  });
});

describe('admin.service.parsePeriodKey', () => {
  it('accepts YYYY_MM', () => {
    expect(parsePeriodKey('2026_05')).toEqual({ year: 2026, month: 5 });
  });
  it('rejects malformed', () => {
    expect(() => parsePeriodKey('bogus')).toThrow();
  });
});
```

### Step 2: Implement

```typescript
import { db } from '../../db/client';
import { addRole, removeRole } from '../../db/repos/user-roles-mutations';
import { getRolesForUser } from '../../db/repos/user-roles';
import { grantAchievement, userHasAchievement } from '../achievements';
import { giveScroll } from '../scrolls';
import { parsePeriod } from '../../shared/period';
import { isKnownAchievement, type AchievementKey } from '../../shared/achievements';

import { setUserBalance } from './repo';

const KNOWN_ROLES = [
  'newbie', 'pending', 'preapproved', 'rejected',
  'regular', 'plus',
  'admin', 'adminPlus', 'super', 'polls', 'adminPolls', 'alumni',
  'selfBanned', 'banned',
] as const;

export type KnownRole = (typeof KNOWN_ROLES)[number];

export function parseUserQuery(input: string): string {
  const t = input.trim().replace(/^@/, '');
  if (t.length === 0) throw new Error('Запрос пуст');
  return t;
}

export function parseBalanceInput(input: string): number {
  const n = Number(input.replace(',', '.').trim());
  if (!Number.isFinite(n)) throw new Error('Баланс должен быть числом');
  return Math.round(n);
}

export function parsePeriodKey(input: string): { year: number; month: number } {
  return parsePeriod(input.trim());
}

export function isKnownRole(role: string): role is KnownRole {
  return (KNOWN_ROLES as readonly string[]).includes(role);
}

export interface UserOverview {
  id: number;
  roles: string[];
  achievements: string[];
  balance: number;
}

export async function getUserOverview(userId: number): Promise<UserOverview> {
  const [roles, balanceRow] = await Promise.all([
    getRolesForUser(db, userId),
    db('user_purchases').where('user_id', userId).first(),
  ]);
  // Achievements: read raw user_achievements (the service helper in features/achievements
  // returns enriched objects, we just need the type strings).
  const achRows = await db('user_achievements').where('user_id', userId).select('achievement_type');
  return {
    id: userId,
    roles,
    achievements: achRows.map((r: { achievement_type: string }) => r.achievement_type),
    balance: balanceRow ? Number(balanceRow.balance) : 0,
  };
}

export async function adminGrantRole(userId: number, role: string): Promise<boolean> {
  if (!isKnownRole(role)) throw new Error(`Неизвестная роль: ${role}`);
  return addRole(db, userId, role);
}

export async function adminRemoveRole(userId: number, role: string): Promise<boolean> {
  if (!isKnownRole(role)) throw new Error(`Неизвестная роль: ${role}`);
  return removeRole(db, userId, role);
}

export async function adminGrantScroll(userId: number, scrollId: string, amount: number): Promise<number> {
  return giveScroll({ userId, scrollId, amount, reason: 'admin_grant' });
}

export async function adminGrantAchievement(
  userId: number,
  type: string,
): Promise<{ applied: boolean; alreadyHad: boolean }> {
  if (!isKnownAchievement(type)) throw new Error(`Неизвестное достижение: ${type}`);
  const has = await userHasAchievement(userId, type as AchievementKey);
  if (has) return { applied: false, alreadyHad: true };
  return grantAchievement({ userId, type: type as AchievementKey });
}

export async function adminSetBalance(userId: number, balance: number): Promise<void> {
  await setUserBalance(db, userId, balance);
}
```

### Step 3: Run + commit

```bash
npx vitest run src/features/admin/service.test.ts
git add src/features/admin/service.ts src/features/admin/service.test.ts
git commit -m "feat(features/admin): validators + role/scroll/achievement grants"
```

---

## Task 3: `src/features/admin/schemas.ts` + `menus.ts`

**Files:**
- Create: `src/features/admin/schemas.ts`
- Create: `src/features/admin/menus.ts`

### Step 1: `schemas.ts`

```typescript
import { z } from 'zod';

export const adminCallback = z.discriminatedUnion('a', [
  z.object({ a: z.literal('adUser'), id: z.number().int() }),
  z.object({ a: z.literal('adGrantRole'), id: z.number().int() }),
  z.object({ a: z.literal('adRemoveRole'), id: z.number().int() }),
  z.object({ a: z.literal('adGrantScroll'), id: z.number().int() }),
  z.object({ a: z.literal('adGrantAch'), id: z.number().int(), key: z.enum(['sbp_payment', 'years_of_service']) }),
  z.object({ a: z.literal('adChangeBalance'), id: z.number().int() }),
  z.object({ a: z.literal('adMonths') }),
  z.object({ a: z.literal('adAddMonth') }),
  z.object({ a: z.literal('adSetMonthChat'), period: z.string(), tier: z.enum(['regular', 'plus']) }),
]);
```

### Step 2: `menus.ts`

```typescript
import { Markup } from 'telegraf';

import { router } from '../../core/router';
import { getStatusDisplay } from '../../shared/user-status';

import type { UserOverview } from './service';
import type { MonthSummary, UserSearchResult } from './repo';
import { adminCallback } from './schemas';

export function userListKeyboard(rows: readonly UserSearchResult[]): ReturnType<typeof Markup.inlineKeyboard> {
  const buttons = rows.map((u) => [
    Markup.button.callback(
      u.username ? `@${u.username}` : [u.firstName, u.lastName].filter(Boolean).join(' ') || `id:${u.id}`,
      router.encode(adminCallback, { a: 'adUser', id: u.id }),
    ),
  ]);
  return Markup.inlineKeyboard(buttons);
}

export function userCard(overview: UserOverview, label: string): { text: string; keyboard: ReturnType<typeof Markup.inlineKeyboard> } {
  const status = getStatusDisplay(overview.roles);
  const text = [
    `<b>${label}</b> (id:${overview.id})`,
    `${status.emoji} ${status.text}`,
    `Роли: ${overview.roles.length === 0 ? '—' : overview.roles.join(', ')}`,
    `Достижения: ${overview.achievements.length === 0 ? '—' : overview.achievements.join(', ')}`,
    `Баланс: ${overview.balance}`,
  ].join('\n');

  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback('🎫 Роль ➕', router.encode(adminCallback, { a: 'adGrantRole', id: overview.id })),
      Markup.button.callback('🎫 Роль ➖', router.encode(adminCallback, { a: 'adRemoveRole', id: overview.id })),
    ],
    [
      Markup.button.callback('📜 Свиток', router.encode(adminCallback, { a: 'adGrantScroll', id: overview.id })),
      Markup.button.callback('💰 Баланс', router.encode(adminCallback, { a: 'adChangeBalance', id: overview.id })),
    ],
    [
      Markup.button.callback('🏆 SBP', router.encode(adminCallback, { a: 'adGrantAch', id: overview.id, key: 'sbp_payment' })),
      Markup.button.callback('🏆 Years', router.encode(adminCallback, { a: 'adGrantAch', id: overview.id, key: 'years_of_service' })),
    ],
  ]);
  return { text, keyboard };
}

export function monthsKeyboard(months: readonly MonthSummary[]): { text: string; keyboard: ReturnType<typeof Markup.inlineKeyboard> } {
  if (months.length === 0) {
    return {
      text: 'Месяцев нет.',
      keyboard: Markup.inlineKeyboard([
        [Markup.button.callback('➕ Добавить месяц', router.encode(adminCallback, { a: 'adAddMonth' }))],
      ]),
    };
  }
  const lines = months.map(
    (m) => `${m.period}/${m.type}: chat=${m.chatId ?? '—'} joined=${m.counterJoined} paid=${m.counterPaid}`,
  );
  const buttons: ReturnType<typeof Markup.button.callback>[][] = [
    [Markup.button.callback('➕ Добавить месяц', router.encode(adminCallback, { a: 'adAddMonth' }))],
  ];
  for (const m of months) {
    if (!m.chatId) {
      buttons.push([
        Markup.button.callback(
          `Set chat: ${m.period}/${m.type}`,
          router.encode(adminCallback, { a: 'adSetMonthChat', period: m.period, tier: m.type as 'regular' | 'plus' }),
        ),
      ]);
    }
  }
  return { text: lines.join('\n'), keyboard: Markup.inlineKeyboard(buttons) };
}
```

### Step 3: Commit

```bash
npm run typecheck
git add src/features/admin/schemas.ts src/features/admin/menus.ts
git commit -m "feat(features/admin): callbacks + user/months menus"
```

---

## Task 4: `src/features/admin/scenes/*` (3 input-driven scenes)

**Files:**
- Create: `src/features/admin/scenes/grant-role.ts`
- Create: `src/features/admin/scenes/grant-scroll.ts`
- Create: `src/features/admin/scenes/change-balance.ts`
- Create: `src/features/admin/scenes/set-month-chat.ts`
- Create: `src/features/admin/scenes/add-month.ts`

Each scene takes a target context (user id or period) in `ctx.scene.state`, prompts for input, validates, mutates, leaves. They follow the same shape as Plan 07's `makeEditFieldScene` but each is bespoke because the mutation differs.

### Step 1: `grant-role.ts`

```typescript
import { Scenes } from 'telegraf';

import { adminGrantRole, adminRemoveRole } from '../service';
import { logger } from '../../../core/observability';

interface State {
  userId?: number;
  mode?: 'add' | 'remove';
}

export const GRANT_ROLE_SCENE_ID = 'admin:grant-role';
export const grantRoleScene = new Scenes.BaseScene<Scenes.SceneContext>(GRANT_ROLE_SCENE_ID);

grantRoleScene.enter(async (ctx) => {
  const state = ctx.scene.state as State;
  if (!state.userId || !state.mode) {
    await ctx.scene.leave();
    return;
  }
  await ctx.reply(`Введи имя роли (${state.mode === 'add' ? 'добавить' : 'удалить'}) или /cancel.`);
});

grantRoleScene.command('cancel', async (ctx) => {
  ctx.scene.state = {};
  await ctx.scene.leave();
  await ctx.reply('Отменено.');
});

grantRoleScene.on('text', async (ctx) => {
  const state = ctx.scene.state as State;
  if (!state.userId || !state.mode) {
    await ctx.scene.leave();
    return;
  }
  const role = ctx.message.text.trim();
  try {
    const applied = state.mode === 'add'
      ? await adminGrantRole(state.userId, role)
      : await adminRemoveRole(state.userId, role);
    await ctx.reply(applied ? '✅ Готово' : 'Без изменений (роль уже была/отсутствовала)');
  } catch (err) {
    logger.warn({ err }, 'admin grant-role: failed');
    await ctx.reply((err as Error).message);
    return;
  }
  ctx.scene.state = {};
  await ctx.scene.leave();
});
```

### Step 2: `grant-scroll.ts`

```typescript
import { Scenes } from 'telegraf';

import { adminGrantScroll } from '../service';

interface State {
  userId?: number;
}

export const GRANT_SCROLL_SCENE_ID = 'admin:grant-scroll';
export const grantScrollScene = new Scenes.BaseScene<Scenes.SceneContext>(GRANT_SCROLL_SCENE_ID);

grantScrollScene.enter(async (ctx) => {
  const state = ctx.scene.state as State;
  if (!state.userId) {
    await ctx.scene.leave();
    return;
  }
  await ctx.reply('Формат: `<scrollId> <amount>` (например `kickstarter 1`). Или /cancel.', { parse_mode: 'Markdown' });
});

grantScrollScene.command('cancel', async (ctx) => {
  ctx.scene.state = {};
  await ctx.scene.leave();
  await ctx.reply('Отменено.');
});

grantScrollScene.on('text', async (ctx) => {
  const state = ctx.scene.state as State;
  if (!state.userId) {
    await ctx.scene.leave();
    return;
  }
  const parts = ctx.message.text.trim().split(/\s+/);
  if (parts.length !== 2) {
    await ctx.reply('Нужно: <scrollId> <amount>');
    return;
  }
  const [scrollId, amountRaw] = parts;
  const amount = Number(amountRaw);
  if (!Number.isInteger(amount) || amount <= 0) {
    await ctx.reply('amount должен быть положительным целым числом');
    return;
  }
  const newBalance = await adminGrantScroll(state.userId, scrollId!, amount);
  await ctx.reply(`✅ Новое количество свитка "${scrollId}": ${newBalance}`);
  ctx.scene.state = {};
  await ctx.scene.leave();
});
```

### Step 3: `change-balance.ts`

```typescript
import { Scenes } from 'telegraf';

import { adminSetBalance, parseBalanceInput } from '../service';

interface State {
  userId?: number;
}

export const CHANGE_BALANCE_SCENE_ID = 'admin:change-balance';
export const changeBalanceScene = new Scenes.BaseScene<Scenes.SceneContext>(CHANGE_BALANCE_SCENE_ID);

changeBalanceScene.enter(async (ctx) => {
  const state = ctx.scene.state as State;
  if (!state.userId) {
    await ctx.scene.leave();
    return;
  }
  await ctx.reply('Введи новое значение баланса (целое число). Или /cancel.');
});

changeBalanceScene.command('cancel', async (ctx) => {
  ctx.scene.state = {};
  await ctx.scene.leave();
  await ctx.reply('Отменено.');
});

changeBalanceScene.on('text', async (ctx) => {
  const state = ctx.scene.state as State;
  if (!state.userId) {
    await ctx.scene.leave();
    return;
  }
  try {
    const balance = parseBalanceInput(ctx.message.text);
    await adminSetBalance(state.userId, balance);
    await ctx.reply(`✅ Баланс установлен: ${balance}`);
  } catch (err) {
    await ctx.reply((err as Error).message);
    return;
  }
  ctx.scene.state = {};
  await ctx.scene.leave();
});
```

### Step 4: `set-month-chat.ts`

```typescript
import { Scenes } from 'telegraf';

import { db } from '../../../db/client';
import { updateMonthChatId } from '../repo';

interface State {
  period?: string;
  tier?: 'regular' | 'plus';
}

export const SET_MONTH_CHAT_SCENE_ID = 'admin:set-month-chat';
export const setMonthChatScene = new Scenes.BaseScene<Scenes.SceneContext>(SET_MONTH_CHAT_SCENE_ID);

setMonthChatScene.enter(async (ctx) => {
  const state = ctx.scene.state as State;
  if (!state.period || !state.tier) {
    await ctx.scene.leave();
    return;
  }
  await ctx.reply(`Перешли любое сообщение из группы для ${state.period}/${state.tier}. Или /cancel.`);
});

setMonthChatScene.command('cancel', async (ctx) => {
  ctx.scene.state = {};
  await ctx.scene.leave();
  await ctx.reply('Отменено.');
});

setMonthChatScene.on('message', async (ctx) => {
  const state = ctx.scene.state as State;
  if (!state.period || !state.tier) {
    await ctx.scene.leave();
    return;
  }
  // Telegraf 4.x exposes the forwarded-from chat as `ctx.message.forward_origin` (or
  // `forward_from_chat` on older clients). Accept either.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m = ctx.message as any;
  const chatId = m.forward_from_chat?.id ?? m.forward_origin?.chat?.id;
  if (chatId === undefined) {
    await ctx.reply('Не вижу id чата. Перешли сообщение из самой группы.');
    return;
  }
  await updateMonthChatId(db, state.period, state.tier, String(chatId));
  await ctx.reply(`✅ chat_id для ${state.period}/${state.tier} установлен: ${chatId}`);
  ctx.scene.state = {};
  await ctx.scene.leave();
});
```

### Step 5: `add-month.ts`

```typescript
import { Scenes } from 'telegraf';

import { db } from '../../../db/client';
import { insertMonth } from '../repo';
import { parsePeriodKey } from '../service';
import { formatPeriod } from '../../../shared/period';

export const ADD_MONTH_SCENE_ID = 'admin:add-month';
export const addMonthScene = new Scenes.BaseScene<Scenes.SceneContext>(ADD_MONTH_SCENE_ID);

addMonthScene.enter(async (ctx) => {
  await ctx.reply('Введи период (YYYY_MM), напр. `2026_06`. Или /cancel.', { parse_mode: 'Markdown' });
});

addMonthScene.command('cancel', async (ctx) => {
  ctx.scene.state = {};
  await ctx.scene.leave();
  await ctx.reply('Отменено.');
});

addMonthScene.on('text', async (ctx) => {
  try {
    const { year, month } = parsePeriodKey(ctx.message.text);
    const period = formatPeriod({ year, month });
    await insertMonth(db, period, 'regular', null);
    await insertMonth(db, period, 'plus', null);
    await ctx.reply(`✅ Добавлены ${period}/regular и ${period}/plus. Установи chat_id командой /admin → Months.`);
  } catch (err) {
    await ctx.reply((err as Error).message);
    return;
  }
  ctx.scene.state = {};
  await ctx.scene.leave();
});
```

### Step 6: Commit

```bash
mkdir -p src/features/admin/scenes
git add src/features/admin/scenes/
git commit -m "feat(features/admin): scenes (grant-role/scroll, change-balance, months)"
```

---

## Task 5: `src/features/admin/actions.ts` + `routes.ts`

**Files:**
- Create: `src/features/admin/actions.ts`
- Create: `src/features/admin/routes.ts`

### Step 1: `actions.ts`

```typescript
import type { Scenes } from 'telegraf';

import { db } from '../../db/client';
import { logger } from '../../core/observability';
import { router } from '../../core/router';
import { isStaff } from '../../shared/user-status';

import { listMonths } from './repo';
import { adminCallback } from './schemas';
import { ADD_MONTH_SCENE_ID } from './scenes/add-month';
import { CHANGE_BALANCE_SCENE_ID } from './scenes/change-balance';
import { GRANT_ROLE_SCENE_ID } from './scenes/grant-role';
import { GRANT_SCROLL_SCENE_ID } from './scenes/grant-scroll';
import { SET_MONTH_CHAT_SCENE_ID } from './scenes/set-month-chat';
import { adminGrantAchievement, getUserOverview } from './service';
import { monthsKeyboard, userCard } from './menus';

export function registerAdminActions(): void {
  router.on(adminCallback, async (ctx, payload) => {
    const roles = ctx.state.roles ?? [];
    if (!isStaff(roles)) {
      await ctx.answerCbQuery?.('Нет прав');
      return;
    }

    try {
      switch (payload.a) {
        case 'adUser': {
          const overview = await getUserOverview(payload.id);
          const { text, keyboard } = userCard(overview, `id:${payload.id}`);
          await ctx.editMessageText(text, { parse_mode: 'HTML', ...keyboard });
          await ctx.answerCbQuery?.();
          break;
        }
        case 'adGrantRole':
          await ctx.answerCbQuery?.();
          await (ctx as unknown as Scenes.SceneContext).scene.enter(GRANT_ROLE_SCENE_ID, { userId: payload.id, mode: 'add' });
          break;
        case 'adRemoveRole':
          await ctx.answerCbQuery?.();
          await (ctx as unknown as Scenes.SceneContext).scene.enter(GRANT_ROLE_SCENE_ID, { userId: payload.id, mode: 'remove' });
          break;
        case 'adGrantScroll':
          await ctx.answerCbQuery?.();
          await (ctx as unknown as Scenes.SceneContext).scene.enter(GRANT_SCROLL_SCENE_ID, { userId: payload.id });
          break;
        case 'adChangeBalance':
          await ctx.answerCbQuery?.();
          await (ctx as unknown as Scenes.SceneContext).scene.enter(CHANGE_BALANCE_SCENE_ID, { userId: payload.id });
          break;
        case 'adGrantAch': {
          const result = await adminGrantAchievement(payload.id, payload.key);
          await ctx.answerCbQuery?.(
            result.alreadyHad ? 'Уже было' : result.applied ? '✅ Выдано' : 'Не выдано',
          );
          break;
        }
        case 'adMonths': {
          const months = await listMonths(db);
          const { text, keyboard } = monthsKeyboard(months);
          await ctx.editMessageText(text, { ...keyboard });
          await ctx.answerCbQuery?.();
          break;
        }
        case 'adAddMonth':
          await ctx.answerCbQuery?.();
          await (ctx as unknown as Scenes.SceneContext).scene.enter(ADD_MONTH_SCENE_ID, {});
          break;
        case 'adSetMonthChat':
          await ctx.answerCbQuery?.();
          await (ctx as unknown as Scenes.SceneContext).scene.enter(SET_MONTH_CHAT_SCENE_ID, {
            period: payload.period,
            tier: payload.tier,
          });
          break;
      }
    } catch (err) {
      logger.error({ err, payload }, 'admin action failed');
      await ctx.answerCbQuery?.('Ошибка');
    }
  });
}
```

### Step 2: `routes.ts`

```typescript
import { Markup, type Telegraf } from 'telegraf';

import { db } from '../../db/client';
import { requireRoles } from '../../core/permissions';
import { router } from '../../core/router';

import { searchUsers } from './repo';
import { adminCallback } from './schemas';
import { userListKeyboard } from './menus';
import { parseUserQuery } from './service';

const ADMIN_ROLES = ['admin', 'adminPlus', 'super'] as const;

export function registerAdminCommands(bot: Telegraf): void {
  bot.command('admin', requireRoles(...ADMIN_ROLES), async (ctx) => {
    await ctx.reply(
      'Админ-меню:',
      Markup.inlineKeyboard([
        [
          Markup.button.callback('📅 Months', router.encode(adminCallback, { a: 'adMonths' })),
        ],
      ]),
    );
  });

  bot.command('admin_find', requireRoles(...ADMIN_ROLES), async (ctx) => {
    const argv = ctx.message.text.replace(/^\/admin_find\s*/i, '').trim();
    if (!argv) {
      await ctx.reply('Использование: /admin_find <id или @username>');
      return;
    }
    try {
      const q = parseUserQuery(argv);
      const rows = await searchUsers(db, q, 20);
      if (rows.length === 0) {
        await ctx.reply('Не найдено.');
        return;
      }
      await ctx.reply(`Найдено: ${rows.length}`, userListKeyboard(rows));
    } catch (err) {
      await ctx.reply((err as Error).message);
    }
  });
}
```

### Step 3: Commit

```bash
npm run typecheck
npm run lint
git add src/features/admin/actions.ts src/features/admin/routes.ts
git commit -m "feat(features/admin): /admin menu + /admin_find user search"
```

---

## Task 6: `src/features/admin/index.ts` + wire into `src/index.ts`

**Files:**
- Create: `src/features/admin/index.ts`
- Modify: `src/index.ts`

### Step 1: `index.ts`

```typescript
import type { Scenes, Telegraf } from 'telegraf';

import { registerAdminActions } from './actions';
import { registerAdminCommands } from './routes';
import { addMonthScene } from './scenes/add-month';
import { changeBalanceScene } from './scenes/change-balance';
import { grantRoleScene } from './scenes/grant-role';
import { grantScrollScene } from './scenes/grant-scroll';
import { setMonthChatScene } from './scenes/set-month-chat';

export function getAdminScenes(): Scenes.BaseScene<Scenes.SceneContext>[] {
  return [grantRoleScene, grantScrollScene, changeBalanceScene, addMonthScene, setMonthChatScene];
}

export function register(bot: Telegraf): void {
  registerAdminCommands(bot);
  registerAdminActions();
}
```

### Step 2: Wire into `src/index.ts`

```typescript
import * as adminFeature from './features/admin';
// ...
const combinedStage = new Scenes.Stage<Scenes.SceneContext>([
  ...Array.from(createRaidStage().scenes.values()),
  ...getKickstarterScenes(),
  ...adminFeature.getAdminScenes(),
  paymentsFeature.sbpScene,
  onboardingFeature.onboardingScene,
]);
// ...
adminFeature.register(bot);
```

### Step 3: Full pipeline check

```bash
npm run gen:locale-types && npm run lint && npm run typecheck && npx vitest run "src/**/*.test.ts" && npm run build && ls dist/
```

All green.

### Step 4: Commit

```bash
git add src/features/admin/index.ts src/index.ts
git commit -m "feat(core): register admin feature with scenes"
```

---

## Task 7: Legacy code removal

**Files:**
- Delete: `index.js`, `indexf.js`, `INTEGRATION_EXAMPLES.js`, `update.sh`
- Delete tree: `modules/`, `configs/`
- Move to `docs/legacy/`: `MIGRATION_GUIDE.md`, `RPG_OVERHAUL.md`, `RPG_DELIVERY_SUMMARY.md`, `RPG_QUICK_REFERENCE.md`, `DATABASE_SCHEMA.md`
- Modify: `package.json` (swap `start` to the new bot)
- Modify: `.eslintignore`, `.prettierignore` (drop legacy entries)
- Modify: `tsconfig.json`, `tsconfig.build.json` (drop legacy excludes)

### Step 1: Prepare

```bash
mkdir -p docs/legacy
git mv MIGRATION_GUIDE.md docs/legacy/
git mv RPG_OVERHAUL.md docs/legacy/
git mv RPG_DELIVERY_SUMMARY.md docs/legacy/
git mv RPG_QUICK_REFERENCE.md docs/legacy/
git mv DATABASE_SCHEMA.md docs/legacy/
```

### Step 2: Delete

```bash
git rm index.js indexf.js INTEGRATION_EXAMPLES.js update.sh
git rm -r modules/ configs/
```

### Step 3: Update `package.json`

In `scripts`:
- Remove `start`, `dev`, `dev:old`.
- Rename `start:new` → `start`, `dev:new` → `dev`.

Result:

```json
"scripts": {
  "start": "node dist/index.js",
  "dev": "tsx watch src/index.ts",
  "build": "tsc -p tsconfig.build.json",
  "typecheck": "tsc --noEmit",
  "lint": "eslint . --ext .ts,.tsx,.js,.cjs",
  "lint:fix": "eslint . --ext .ts,.tsx,.js,.cjs --fix",
  "format": "prettier --write \"src/**/*.{ts,tsx,json}\" \"tests/**/*.ts\"",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage",
  "test:integration": "vitest run tests/integration",
  "gen:locale-types": "tsx scripts/gen-locale-types.ts",
  "migrate": "knex --knexfile knexfile.ts migrate:latest",
  "migrate:rollback": "knex --knexfile knexfile.ts migrate:rollback",
  "migrate:test": "cross-env NODE_ENV=test knex --knexfile knexfile.ts migrate:latest",
  "seed": "knex --knexfile knexfile.ts seed:run",
  "db:status": "knex --knexfile knexfile.ts migrate:status",
  "db:list": "knex --knexfile knexfile.ts migrate:list",
  "audit": "tsx scripts/pre-migration-audit.ts"
}
```

NOTE: the `nodemon` devDep is no longer needed; can be removed in a follow-up. Leave for now to avoid churn.

### Step 4: Drop legacy excludes

`.eslintignore`: remove these lines:
```
modules
configs
backups
index.js
indexf.js
INTEGRATION_EXAMPLES.js
scripts/*.js
```
(Keep `node_modules`, `dist`, `coverage`, `locales`, `docs`, and `src/core/i18n-keys.generated.ts`.)

`.prettierignore`: remove `modules` and `backups` (keep `node_modules`, `dist`, `coverage`, `locales`, `package-lock.json`, `*.md`, `.env*`).

`tsconfig.json`: remove `"modules"`, `"index.js"`, `"indexf.js"`, `"INTEGRATION_EXAMPLES.js"` from `exclude`. Final exclude: `["node_modules", "dist"]`.

`tsconfig.build.json`: remove `"modules"` from exclude.

`vitest.config.ts`: in `test.exclude`, drop `'modules'`. Final exclude: `['node_modules', 'dist']`.

### Step 5: Verify

```bash
npm run lint
npm run typecheck
npm test
npm run build
node dist/index.js  # boots; expect to fail on real env config but no import errors
```

If any import resolves to the deleted `modules/` tree, fix the import.

### Step 6: Commit

```bash
git add -A
git commit -m "chore: remove legacy JS codebase (modules/, configs/, index.js)"
```

This is a large commit — likely 200+ files. Acceptable for the cutover transition.

---

## Task 8: Update `docs/dev-setup.md` (drop the "legacy bot" section)

**Files:**
- Modify: `docs/dev-setup.md`

### Step 1: Remove the legacy mention from the command table

The current dev-setup table has:
```
| `npm run start` / `npm run dev` | Run the legacy JS bot (still in place) |
```

Remove that row. Update the new commands:

```markdown
| `npm start`               | Run the compiled bot                          |
| `npm run dev`             | Run the bot in watch mode                     |
```

Also remove the paragraph: "The legacy JavaScript codebase (`index.js`, `modules/`) stays in place until the cutover plan executes; nothing in `src/` interferes with it."

### Step 2: Commit

```bash
git add docs/dev-setup.md
git commit -m "docs: update dev-setup for post-cutover commands"
```

---

## Task 9: Cutover runbook

**Files:**
- Create: `docs/superpowers/runbooks/cutover.md`

### Step 1: Write the runbook

```markdown
# Cutover Runbook

## Pre-flight (T-24h)

- [ ] `git status` clean on `rewrite` branch.
- [ ] `npm ci && npm run build && npm test` — all green.
- [ ] `.env` populated with:
      `TOKEN`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`,
      `REDIS_HOST`, `REDIS_PORT`, optional `REDIS_PASSWORD`,
      `ADMIN_NOTIFICATIONS_CHAT`, optional `SENTRY_DSN`, optional `TEST_USER_ID`.
- [ ] PostgreSQL reachable; user has `CREATE` on the target schema.
- [ ] Redis reachable.
- [ ] Run `npm run audit` against the production DB; resolve any anomalies it
      reports (duplicate achievements, stale `paymentTracking.pending` > 30 days,
      `userGroups` rows lacking `paymentTracking`).

## Backup (T-1h)

- [ ] `pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME -Fc -f goblin_$(date +%Y%m%d_%H%M%S).dump`
- [ ] Verify the dump file size is non-zero and reasonable.
- [ ] Copy the dump to a SECOND location (USB, cloud) — this is your only recovery.

## Stop the legacy bot

- [ ] Stop the running legacy process (whatever process manager you use:
      `pm2 stop bot`, `systemctl stop goblin-bot`, or kill it directly).
- [ ] Confirm it's not running: no replies to a test `/start`.

## Migrate

- [ ] `npm run migrate` — applies migrations 017–022.
- [ ] Watch for the per-migration log lines. If any migration fails, the
      transaction rolls back and the DB is left at the previous state.
- [ ] If a migration fails: restore from the dump, investigate, fix, re-try.

## Smoke-check the migrated schema

- [ ] `psql ... -c "SELECT COUNT(*) FROM users"` — same count as pre-migration.
- [ ] `psql ... -c "SELECT COUNT(*) FROM user_groups"` — same count.
- [ ] `psql ... -c "SELECT COUNT(*) FROM payment_tracking"` — same count.
- [ ] `psql ... -c "SELECT DISTINCT source FROM payment_tracking"` — should
      include `'stars'` (backfilled by migration 019).
- [ ] `psql ... -c "\d users"` — column names are snake_case
      (`first_name`, `created_at`, etc.).
- [ ] `psql ... -c "SELECT 1 FROM user_loyalty LIMIT 1"` — should error
      "relation does not exist" (dropped by migration 021).

## Start the new bot

- [ ] `npm start` (or your process-manager start command pointing at
      `node dist/index.js`).
- [ ] Tail logs for 5 minutes.
- [ ] In Telegram, send `/start` from a test account. Verify response.
- [ ] If staff, send `/admin` — verify the admin menu opens.
- [ ] Send a small Telegram Stars test payment (e.g., for an old month or
      a kickstarter that costs <50 stars). Verify:
      - `pre_checkout_query` accepted
      - `successful_payment` processed
      - DM confirmation received
      - `payment_tracking` row with `status='completed'` and the
        `telegram_payment_charge_id` set.

## Soak (T+1h to T+24h)

- [ ] Monitor logs for `error.unhandled`, `payments.precheckout_rejected`,
      `payments.unknown_payload` counters.
- [ ] Watch `metrics.snapshot()` (admin command `/admin metrics` if exposed,
      otherwise via SQL on the metrics counters that are logged hourly).

## Rollback criteria

Rollback if ANY of the following are observed within the first 24h:

- A payment succeeds in Telegram but the user did NOT get access.
- Any user is in `user_groups` they did not pay for.
- Any double-charge (two `payment_tracking` rows with the same
  `telegram_payment_charge_id` — should be impossible due to UNIQUE, but
  watch anyway).
- Significant data corruption (counters dropping, NULLs where there shouldn't be).

UI glitches, missing admin commands, or one-off errors are NOT rollback
criteria — fix forward.

## Rollback procedure

1. Stop the new bot: `npm stop` / `pm2 stop` / `systemctl stop`.
2. Drop the migrated DB or restore from the pre-migration dump:
   ```
   psql ... -c "DROP DATABASE goblin_bot"
   psql ... -c "CREATE DATABASE goblin_bot"
   pg_restore -h $DB_HOST -U $DB_USER -d $DB_NAME goblin_<dump>.dump
   ```
3. Check out the `legacy` tag (created automatically by the rewrite branch
   merge OR manually before cutover): `git checkout legacy`.
4. Start the legacy bot.
5. Telegram payments that arrived during the rollback window may be lost;
   manually reconcile from `payment_tracking` audit if any did.

Estimated recovery time: 15–30 minutes.

## Post-cutover (T+1w)

- [ ] Archive the legacy code branch.
- [ ] Tag the cutover commit (`git tag -a cutover -m "..."`).
- [ ] Update on-call docs if any.
```

### Step 2: Commit

```bash
mkdir -p docs/superpowers/runbooks
# write the runbook above
git add docs/superpowers/runbooks/cutover.md
git commit -m "docs: cutover runbook"
```

---

## Self-review checklist

- [ ] `npm test` — all unit tests pass (~210+).
- [ ] `npm run typecheck`, `npm run lint`, `npm run build` clean.
- [ ] No `require(` calls anywhere in `src/`.
- [ ] No file in `src/` imports from `modules/`, `configs/`, or `index.js` (deleted).
- [ ] `package.json` scripts updated: `npm start` runs the new bot.
- [ ] `node dist/index.js` boots far enough to log "starting" and then fail on
      env config or DB connectivity if those are absent.
- [ ] The runbook covers the full happy path AND the rollback path.

---

## Niche admin actions left for follow-up plans (not in this plan)

These exist in the legacy code but are deferred because they're rarely used; admins can use SQL until they're rebuilt:

- Promo file upload via bot (`/admin_promo_upload`) — direct DB insert is fine.
- Kickstarter price audit script — `scripts/` already has the legacy JS version; rewrite later.
- Stars balance + withdrawal status (Telegram has a stable web UI for this).
- Bulk payment-code generation (the entire payment-code subsystem was confirmed dead in the audit; dropped from scope).
- "Resend invite" admin action — equivalent: admin runs `/admin_find <user>` then asks the user to `/joinlink`.
- Lots / auction admin tools — scope decision: lots subsystem removed entirely (migration 021).

---

This is the final plan. After this, the bot runs entirely on TypeScript code under `src/`, the legacy JS is gone, and the cutover is documented.
