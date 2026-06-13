# Plan 09 — Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `src/features/onboarding/` — replace the legacy looping application funnel with a single linear scene; split the 912-line `allApplications.js` admin god-file into focused list / single-user / service modules; extract the role→{emoji, text} mapping duplicated 4+ times in the legacy code into `shared/user-status.ts`.

**Architecture:** Standard `src/features/<x>/` shape plus a small admin subfolder. Users journey: `/start` → "О боте" (info screen) → "Подать заявку" → linear scene (intro → confirm → submit) → application row created in `applications` with `status='pending'`. Admins see a paginated list, can open a single user's card, and approve or reject — both actions issue role transitions via the RBAC repo (Plan 03) and DM the user.

**Tech Stack:** TypeScript, Telegraf v4 + Scenes, knex, Vitest, zod.

**Spec reference:** §4.3 of `docs/superpowers/specs/2026-05-17-bot-greenfield-rewrite-design.md`.

**Prerequisites:** Plans 01–08 complete. After migration 018 the `applications` table is snake_case: `id`, `user_id`, `username`, `first_name`, `last_name`, `status`, `invitation_code`, `created_at`, `updated_at`. There is NO `answers` column — questionnaire answers are not persisted in production (per memory note).

**Out of scope:**
- Invitations / chat-join handling (next plan).
- Per-user balance, scrolls grants on approval (admin tools, Plan 11).
- Membership-status-driven main menus (existing legacy `users/menus/*` map — rebuilt in a later UX plan; for now the `/start` screen is minimal).

---

## Roles model (used throughout the plan)

The bot uses these role strings in `user_roles`:

- `newbie` — unknown / first interaction
- `pending` — applied, waiting for admin review
- `preapproved` — admin approved; can now buy access
- `rejected` — admin rejected
- `selfBanned` — user opted out
- `banned` — admin-banned
- `regular`, `plus` — derived from `user_groups`, not stored as a role here
- `admin`, `adminPlus`, `super`, `polls`, `adminPolls`, `alumni` — admin/staff variants

Application state transitions (driven by `onboarding.service`):

- new user `/start` → optionally enters scene → submit ⇒ inserts `applications` row (`status='pending'`) + adds `pending` role
- admin approve ⇒ `applications.status='approved'`, removes `pending`, adds `preapproved`
- admin reject ⇒ `applications.status='rejected'`, removes `pending`, adds `rejected`

---

## File Structure

**Created (`src/shared/`):**
- `user-status.ts` + `user-status.test.ts`

**Created (`src/features/onboarding/`):**
- `repo.ts`
- `service.ts` + `service.test.ts`
- `schemas.ts`
- `menus.ts`
- `scene.ts` (the single linear `OnboardingScene`)
- `routes.ts` (`/start`)
- `index.ts`

**Created (`src/features/onboarding/admin/`):**
- `repo.ts` (admin-specific queries: paginated list, search)
- `service.ts` (approve, reject — role transitions + DMs)
- `menus.ts`
- `list-routes.ts`
- `single-user-routes.ts`
- `index.ts`

**Created (`src/db/repos/`):**
- `user-roles-mutations.ts` (add/remove role — extending the existing user-roles.ts read API)

**Created (integration test):**
- `tests/integration/onboarding.repo.test.ts`

**Modified:**
- `src/index.ts` — register onboarding feature + onboarding scene

---

## Task 1: `src/shared/user-status.ts` (TDD)

**Files:**
- Create: `src/shared/user-status.ts`
- Create: `src/shared/user-status.test.ts`

### Step 1: Test

```typescript
import { describe, expect, it } from 'vitest';

import { getStatusDisplay, isMember, isStaff } from './user-status';

describe('shared.user-status.getStatusDisplay', () => {
  it('returns "newbie" for empty roles', () => {
    const s = getStatusDisplay([]);
    expect(s.code).toBe('newbie');
    expect(s.emoji).toBeTruthy();
    expect(s.text).toBeTruthy();
  });

  it('prefers banned over everything', () => {
    expect(getStatusDisplay(['banned', 'preapproved', 'plus']).code).toBe('banned');
    expect(getStatusDisplay(['selfBanned', 'preapproved']).code).toBe('selfBanned');
  });

  it('returns "super" when present', () => {
    expect(getStatusDisplay(['super', 'admin']).code).toBe('super');
  });

  it('returns "admin" before "preapproved"', () => {
    expect(getStatusDisplay(['admin', 'preapproved']).code).toBe('admin');
  });

  it('returns "preapproved" when approved but not yet a paying member', () => {
    expect(getStatusDisplay(['preapproved']).code).toBe('preapproved');
  });

  it('returns "pending" for applicants', () => {
    expect(getStatusDisplay(['pending']).code).toBe('pending');
  });

  it('returns "rejected" only when not also preapproved/admin', () => {
    expect(getStatusDisplay(['rejected']).code).toBe('rejected');
    expect(getStatusDisplay(['rejected', 'preapproved']).code).toBe('preapproved');
  });
});

describe('shared.user-status.isMember', () => {
  it('true when preapproved (paying access flows downstream)', () => {
    expect(isMember(['preapproved'])).toBe(true);
  });
  it('false for newbie/pending/rejected/banned', () => {
    expect(isMember([])).toBe(false);
    expect(isMember(['pending'])).toBe(false);
    expect(isMember(['rejected'])).toBe(false);
    expect(isMember(['banned'])).toBe(false);
  });
});

describe('shared.user-status.isStaff', () => {
  it('true for admin/adminPlus/super', () => {
    expect(isStaff(['admin'])).toBe(true);
    expect(isStaff(['adminPlus'])).toBe(true);
    expect(isStaff(['super'])).toBe(true);
  });
  it('false otherwise', () => {
    expect(isStaff([])).toBe(false);
    expect(isStaff(['preapproved'])).toBe(false);
    expect(isStaff(['polls'])).toBe(false);
  });
});
```

### Step 2: Implement

```typescript
export type StatusCode =
  | 'newbie'
  | 'pending'
  | 'preapproved'
  | 'rejected'
  | 'selfBanned'
  | 'banned'
  | 'admin'
  | 'super'
  | 'alumni';

export interface StatusDisplay {
  code: StatusCode;
  emoji: string;
  text: string;
}

/** Display priorities ordered HIGH→LOW. The first role in this list that the user has wins. */
const PRIORITY: ReadonlyArray<{ role: string; display: StatusDisplay }> = [
  { role: 'banned', display: { code: 'banned', emoji: '🚫', text: 'Заблокирован' } },
  { role: 'selfBanned', display: { code: 'selfBanned', emoji: '👋', text: 'Сам отписался' } },
  { role: 'super', display: { code: 'super', emoji: '👑', text: 'Супер-админ' } },
  { role: 'adminPlus', display: { code: 'admin', emoji: '🛠️', text: 'Админ Plus' } },
  { role: 'admin', display: { code: 'admin', emoji: '🛠️', text: 'Админ' } },
  { role: 'alumni', display: { code: 'alumni', emoji: '🎓', text: 'Выпускник' } },
  { role: 'preapproved', display: { code: 'preapproved', emoji: '✅', text: 'Одобрен' } },
  { role: 'pending', display: { code: 'pending', emoji: '⏳', text: 'Заявка на рассмотрении' } },
  { role: 'rejected', display: { code: 'rejected', emoji: '🙅', text: 'Отклонён' } },
];

export function getStatusDisplay(roles: readonly string[]): StatusDisplay {
  const set = new Set(roles);
  for (const entry of PRIORITY) {
    if (set.has(entry.role)) return entry.display;
  }
  return { code: 'newbie', emoji: '🌱', text: 'Новичок' };
}

export function isMember(roles: readonly string[]): boolean {
  const set = new Set(roles);
  return set.has('preapproved') || set.has('admin') || set.has('adminPlus') || set.has('super');
}

export function isStaff(roles: readonly string[]): boolean {
  const set = new Set(roles);
  return set.has('admin') || set.has('adminPlus') || set.has('super');
}
```

### Step 3: Run + commit

```bash
npx vitest run src/shared/user-status.test.ts
git add src/shared/user-status.ts src/shared/user-status.test.ts
git commit -m "feat(shared): user-status display (replaces 4+ legacy duplicates)"
```

---

## Task 2: `src/db/repos/user-roles-mutations.ts`

The existing `src/db/repos/user-roles.ts` (Plan 03) has read-only helpers. Add write helpers in a separate file to keep concerns clear.

**Files:**
- Create: `src/db/repos/user-roles-mutations.ts`

### Step 1: Implement

```typescript
import type { DbConn } from '../client';

const UNIQUE_VIOLATION = '23505';

/** Idempotent add. Relies on UNIQUE(user_id, role) — adjust if your schema doesn't have it. */
export async function addRole(conn: DbConn, userId: number, role: string): Promise<boolean> {
  try {
    await conn('user_roles').insert({ user_id: userId, role });
    return true;
  } catch (err) {
    if ((err as { code?: string }).code === UNIQUE_VIOLATION) return false;
    throw err;
  }
}

export async function removeRole(conn: DbConn, userId: number, role: string): Promise<boolean> {
  const n = await conn('user_roles').where({ user_id: userId, role }).delete();
  return n > 0;
}

/** Atomic replace: removes `fromRole`, adds `toRole` in a transaction. */
export async function replaceRole(
  conn: DbConn,
  userId: number,
  fromRole: string,
  toRole: string,
): Promise<void> {
  await conn.transaction(async (trx) => {
    await trx('user_roles').where({ user_id: userId, role: fromRole }).delete();
    try {
      await trx('user_roles').insert({ user_id: userId, role: toRole });
    } catch (err) {
      if ((err as { code?: string }).code !== UNIQUE_VIOLATION) throw err;
      // toRole already present — fine.
    }
  });
}
```

NOTE: if `user_roles` doesn't have a UNIQUE(user_id, role) constraint, adding one is a separate migration not in scope here. The `replaceRole` `try/catch` makes the operation idempotent either way.

### Step 2: Commit

```bash
git add src/db/repos/user-roles-mutations.ts
git commit -m "feat(db/repos): user-roles add/remove/replace helpers"
```

---

## Task 3: `src/features/onboarding/repo.ts`

**Files:**
- Create: `src/features/onboarding/repo.ts`

### Step 1: Implement

```typescript
import type { DbConn } from '../../db/client';

export type ApplicationStatus = 'pending' | 'approved' | 'rejected';

export interface ApplicationRow {
  id: number;
  userId: number;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  status: ApplicationStatus;
  invitationCode: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function rowToApp(row: Record<string, unknown> | undefined): ApplicationRow | undefined {
  if (!row) return undefined;
  return {
    id: row.id as number,
    userId: row.user_id as number,
    username: (row.username as string | null) ?? null,
    firstName: (row.first_name as string | null) ?? null,
    lastName: (row.last_name as string | null) ?? null,
    status: row.status as ApplicationStatus,
    invitationCode: (row.invitation_code as string | null) ?? null,
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
  };
}

export async function getApplicationByUserId(
  conn: DbConn,
  userId: number,
): Promise<ApplicationRow | undefined> {
  const row = await conn('applications').where('user_id', userId).first();
  return rowToApp(row);
}

export async function getApplicationById(
  conn: DbConn,
  id: number,
): Promise<ApplicationRow | undefined> {
  const row = await conn('applications').where('id', id).first();
  return rowToApp(row);
}

export interface InsertApplicationInput {
  userId: number;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
}

export async function insertApplication(
  conn: DbConn,
  input: InsertApplicationInput,
): Promise<number> {
  const [row] = await conn('applications')
    .insert({
      user_id: input.userId,
      username: input.username,
      first_name: input.firstName,
      last_name: input.lastName,
      status: 'pending',
    })
    .returning('id');
  return row.id;
}

export async function setApplicationStatus(
  conn: DbConn,
  id: number,
  status: ApplicationStatus,
): Promise<void> {
  await conn('applications')
    .where('id', id)
    .update({ status, updated_at: conn.fn.now() });
}

export interface ListFilter {
  status?: ApplicationStatus;
  limit?: number;
  offset?: number;
}

export async function listApplications(
  conn: DbConn,
  filter: ListFilter = {},
): Promise<ApplicationRow[]> {
  const q = conn('applications').orderBy('created_at', 'desc');
  if (filter.status) q.where('status', filter.status);
  if (filter.limit !== undefined) q.limit(filter.limit);
  if (filter.offset !== undefined) q.offset(filter.offset);
  const rows = await q;
  return rows.map(rowToApp) as ApplicationRow[];
}

export async function countApplications(
  conn: DbConn,
  filter: { status?: ApplicationStatus } = {},
): Promise<number> {
  const q = conn('applications');
  if (filter.status) q.where('status', filter.status);
  const result = await q.count<{ count: string }[]>('id as count');
  return Number(result[0]?.count ?? 0);
}
```

### Step 2: Commit

```bash
mkdir -p src/features/onboarding
git add src/features/onboarding/repo.ts
git commit -m "feat(features/onboarding): applications repository"
```

---

## Task 4: `src/features/onboarding/service.ts` (TDD)

**Files:**
- Create: `src/features/onboarding/service.ts`
- Create: `src/features/onboarding/service.test.ts`

### Step 1: Test (validation only — DB ops covered by integration)

```typescript
import { describe, expect, it } from 'vitest';

import { canSubmit } from './service';

describe('onboarding.service.canSubmit', () => {
  it('true when no existing application', () => {
    expect(canSubmit(undefined)).toBe(true);
  });

  it('false when an application is already pending', () => {
    expect(canSubmit({ status: 'pending' } as never)).toBe(false);
  });

  it('false when already approved', () => {
    expect(canSubmit({ status: 'approved' } as never)).toBe(false);
  });

  it('true when previously rejected (allow re-apply)', () => {
    expect(canSubmit({ status: 'rejected' } as never)).toBe(true);
  });
});
```

### Step 2: Implement

```typescript
import { db, type DbConn } from '../../db/client';
import { addRole, removeRole, replaceRole } from '../../db/repos/user-roles-mutations';
import { logger } from '../../core/observability';
import { bot } from '../../core/bot';

import {
  getApplicationByUserId,
  insertApplication,
  setApplicationStatus,
  type ApplicationRow,
  type ApplicationStatus,
} from './repo';

export function canSubmit(existing: ApplicationRow | undefined): boolean {
  if (!existing) return true;
  return existing.status === 'rejected';
}

export interface SubmitInput {
  userId: number;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
}

export type SubmitResult =
  | { status: 'submitted'; applicationId: number }
  | { status: 'already_pending'; applicationId: number }
  | { status: 'already_approved'; applicationId: number };

/** Submit an application + add the `pending` role atomically. */
export async function submit(input: SubmitInput): Promise<SubmitResult> {
  return db.transaction(async (trx) => submitInTrx(trx, input));
}

async function submitInTrx(trx: DbConn, input: SubmitInput): Promise<SubmitResult> {
  const existing = await getApplicationByUserId(trx, input.userId);
  if (existing) {
    if (existing.status === 'pending') {
      return { status: 'already_pending', applicationId: existing.id };
    }
    if (existing.status === 'approved') {
      return { status: 'already_approved', applicationId: existing.id };
    }
    // rejected → allow re-apply: flip status back to pending
    await setApplicationStatus(trx, existing.id, 'pending');
    await removeRole(trx, input.userId, 'rejected');
    await addRole(trx, input.userId, 'pending');
    return { status: 'submitted', applicationId: existing.id };
  }
  const id = await insertApplication(trx, input);
  await addRole(trx, input.userId, 'pending');
  return { status: 'submitted', applicationId: id };
}

export type ReviewResult = 'approved' | 'rejected' | 'not_found' | 'not_pending';

/** Approve an application: status → 'approved', `pending`→`preapproved`, DM the user. */
export async function approve(applicationId: number, reviewerId: number): Promise<ReviewResult> {
  const outcome = await db.transaction(async (trx) => {
    const app = await trx('applications').where('id', applicationId).first();
    if (!app) return { result: 'not_found' as const };
    if (app.status !== 'pending') return { result: 'not_pending' as const };
    await setApplicationStatus(trx, applicationId, 'approved');
    await replaceRole(trx, app.user_id, 'pending', 'preapproved');
    return { result: 'approved' as const, userId: app.user_id as number };
  });

  if (outcome.result === 'approved') {
    void notifyApproval(outcome.userId).catch((err) => logger.debug({ err }, 'notifyApproval failed'));
    logger.info({ applicationId, reviewerId, userId: outcome.userId }, 'application approved');
  }
  return outcome.result;
}

/** Reject an application: status → 'rejected', `pending`→`rejected`, DM the user. */
export async function reject(applicationId: number, reviewerId: number): Promise<ReviewResult> {
  const outcome = await db.transaction(async (trx) => {
    const app = await trx('applications').where('id', applicationId).first();
    if (!app) return { result: 'not_found' as const };
    if (app.status !== 'pending') return { result: 'not_pending' as const };
    await setApplicationStatus(trx, applicationId, 'rejected');
    await replaceRole(trx, app.user_id, 'pending', 'rejected');
    return { result: 'rejected' as const, userId: app.user_id as number };
  });

  if (outcome.result === 'rejected') {
    void notifyRejection(outcome.userId).catch((err) => logger.debug({ err }, 'notifyRejection failed'));
    logger.info({ applicationId, reviewerId, userId: outcome.userId }, 'application rejected');
  }
  return outcome.result;
}

async function notifyApproval(userId: number): Promise<void> {
  await bot.telegram.sendMessage(
    userId,
    '✅ Твоя заявка одобрена. Теперь можно купить доступ командой /buy.',
  );
}

async function notifyRejection(userId: number): Promise<void> {
  await bot.telegram.sendMessage(userId, '🙅 К сожалению, твоя заявка отклонена.');
}

export type { ApplicationRow, ApplicationStatus };
```

### Step 3: Run + commit

```bash
npx vitest run src/features/onboarding/service.test.ts
git add src/features/onboarding/service.ts src/features/onboarding/service.test.ts
git commit -m "feat(features/onboarding): submit/approve/reject with role transitions"
```

---

## Task 5: `src/features/onboarding/schemas.ts` + `menus.ts`

**Files:**
- Create: `src/features/onboarding/schemas.ts`
- Create: `src/features/onboarding/menus.ts`

### Step 1: `schemas.ts`

```typescript
import { z } from 'zod';

export const onboardingCallback = z.discriminatedUnion('a', [
  z.object({ a: z.literal('onApplyStart') }), // user starts the application scene
  z.object({ a: z.literal('onAbout') }), // user wants info
  z.object({ a: z.literal('onCancel') }), // back from any screen
]);

export const onboardingAdminCallback = z.discriminatedUnion('a', [
  z.object({ a: z.literal('onAdminList'), page: z.number().int() }),
  z.object({ a: z.literal('onAdminFilter'), status: z.enum(['pending', 'approved', 'rejected']), page: z.number().int() }),
  z.object({ a: z.literal('onAdminView'), id: z.number().int() }),
  z.object({ a: z.literal('onAdminApprove'), id: z.number().int() }),
  z.object({ a: z.literal('onAdminReject'), id: z.number().int() }),
  z.object({ a: z.literal('onAdminBack'), page: z.number().int() }),
]);
```

### Step 2: `menus.ts`

```typescript
import { Markup } from 'telegraf';

import { router } from '../../core/router';

import { onboardingCallback, onboardingAdminCallback } from './schemas';
import type { ApplicationRow } from './repo';

export function startMenuForNewbie(): ReturnType<typeof Markup.inlineKeyboard> {
  return Markup.inlineKeyboard([
    [Markup.button.callback('Что это такое?', router.encode(onboardingCallback, { a: 'onAbout' }))],
    [Markup.button.callback('Подать заявку', router.encode(onboardingCallback, { a: 'onApplyStart' }))],
  ]);
}

export function aboutMenu(): ReturnType<typeof Markup.inlineKeyboard> {
  return Markup.inlineKeyboard([
    [Markup.button.callback('Подать заявку', router.encode(onboardingCallback, { a: 'onApplyStart' }))],
    [Markup.button.callback('« Назад', router.encode(onboardingCallback, { a: 'onCancel' }))],
  ]);
}

export function pendingMenu(): ReturnType<typeof Markup.inlineKeyboard> {
  return Markup.inlineKeyboard([]);
}

export function adminListItemButton(app: ApplicationRow): ReturnType<typeof Markup.button.callback> {
  const display = app.username ? `@${app.username}` : [app.firstName, app.lastName].filter(Boolean).join(' ') || `id:${app.userId}`;
  return Markup.button.callback(display, router.encode(onboardingAdminCallback, { a: 'onAdminView', id: app.id }));
}

export function adminPagination(page: number, hasNext: boolean): ReturnType<typeof Markup.button.callback>[] {
  const buttons: ReturnType<typeof Markup.button.callback>[] = [];
  if (page > 0) {
    buttons.push(Markup.button.callback('«', router.encode(onboardingAdminCallback, { a: 'onAdminList', page: page - 1 })));
  }
  if (hasNext) {
    buttons.push(Markup.button.callback('»', router.encode(onboardingAdminCallback, { a: 'onAdminList', page: page + 1 })));
  }
  return buttons;
}

export function adminFilterRow(): ReturnType<typeof Markup.button.callback>[] {
  return [
    Markup.button.callback('⏳ Pending', router.encode(onboardingAdminCallback, { a: 'onAdminFilter', status: 'pending', page: 0 })),
    Markup.button.callback('✅ Approved', router.encode(onboardingAdminCallback, { a: 'onAdminFilter', status: 'approved', page: 0 })),
    Markup.button.callback('🙅 Rejected', router.encode(onboardingAdminCallback, { a: 'onAdminFilter', status: 'rejected', page: 0 })),
  ];
}

export function adminViewKeyboard(app: ApplicationRow, page: number): ReturnType<typeof Markup.inlineKeyboard> {
  const rows: ReturnType<typeof Markup.button.callback>[][] = [];
  if (app.status === 'pending') {
    rows.push([
      Markup.button.callback('✅ Approve', router.encode(onboardingAdminCallback, { a: 'onAdminApprove', id: app.id })),
      Markup.button.callback('🙅 Reject', router.encode(onboardingAdminCallback, { a: 'onAdminReject', id: app.id })),
    ]);
  }
  rows.push([Markup.button.callback('« Назад', router.encode(onboardingAdminCallback, { a: 'onAdminBack', page }))]);
  return Markup.inlineKeyboard(rows);
}
```

### Step 3: Commit

```bash
npm run typecheck
git add src/features/onboarding/schemas.ts src/features/onboarding/menus.ts
git commit -m "feat(features/onboarding): callbacks + keyboards"
```

---

## Task 6: `src/features/onboarding/scene.ts` (linear scene)

**Files:**
- Create: `src/features/onboarding/scene.ts`

### Step 1: Implement

```typescript
import { Markup, Scenes } from 'telegraf';

import { logger } from '../../core/observability';

import { submit } from './service';

export const ONBOARDING_SCENE_ID = 'onboarding:apply';

export const onboardingScene = new Scenes.BaseScene<Scenes.SceneContext>(ONBOARDING_SCENE_ID);

const INTRO_TEXT = `<b>Подача заявки</b>

Расскажи коротко о себе: где работаешь, чем увлекаешься, как нашёл нас. Это поможет нам тебя одобрить.

Когда будешь готов — нажми «Отправить». Или «Отмена», чтобы выйти.`;

onboardingScene.enter(async (ctx) => {
  await ctx.reply(INTRO_TEXT, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('✅ Отправить', 'onboarding:submit')],
      [Markup.button.callback('❌ Отмена', 'onboarding:cancel')],
    ]),
  });
});

onboardingScene.action('onboarding:cancel', async (ctx) => {
  ctx.scene.state = {};
  await ctx.scene.leave();
  await ctx.editMessageText('Отменено. Можешь вернуться позже.');
});

onboardingScene.action('onboarding:submit', async (ctx) => {
  if (!ctx.from) {
    await ctx.scene.leave();
    return;
  }
  try {
    const result = await submit({
      userId: ctx.from.id,
      username: ctx.from.username ?? null,
      firstName: ctx.from.first_name ?? null,
      lastName: ctx.from.last_name ?? null,
    });
    switch (result.status) {
      case 'submitted':
        await ctx.editMessageText('✅ Заявка отправлена. Жди ответа админа.');
        break;
      case 'already_pending':
        await ctx.editMessageText('Заявка уже на рассмотрении.');
        break;
      case 'already_approved':
        await ctx.editMessageText('Ты уже одобрен. Используй /buy для покупки доступа.');
        break;
    }
  } catch (err) {
    logger.error({ err, userId: ctx.from.id }, 'onboarding submit failed');
    await ctx.editMessageText('Что-то сломалось. Попробуй позже.');
  } finally {
    ctx.scene.state = {};
    await ctx.scene.leave();
  }
});

onboardingScene.command('cancel', async (ctx) => {
  ctx.scene.state = {};
  await ctx.scene.leave();
  await ctx.reply('Отменено.');
});

onboardingScene.on('message', async (ctx) => {
  await ctx.reply('Используй кнопки «Отправить» или «Отмена».');
});
```

### Step 2: Commit

```bash
npm run typecheck
git add src/features/onboarding/scene.ts
git commit -m "feat(features/onboarding): linear application scene"
```

---

## Task 7: `src/features/onboarding/routes.ts`

**Files:**
- Create: `src/features/onboarding/routes.ts`

`/start` is the central onboarding entrypoint. It branches on the user's current status (read via `getStatusDisplay`).

### Step 1: Implement

```typescript
import type { Scenes, Telegraf } from 'telegraf';

import { db } from '../../db/client';
import { getRolesForUser } from '../../db/repos/user-roles';
import { router } from '../../core/router';
import { getStatusDisplay } from '../../shared/user-status';

import { aboutMenu, pendingMenu, startMenuForNewbie } from './menus';
import { onboardingCallback } from './schemas';
import { ONBOARDING_SCENE_ID } from './scene';

const ABOUT_TEXT = `Этот бот раздаёт доступ к закрытым месяцам и принимает заявки на вступление. После одобрения админом ты сможешь оплатить доступ к текущему месяцу.`;

export function registerOnboardingCommands(bot: Telegraf): void {
  bot.command('start', async (ctx) => {
    if (!ctx.from) return;
    const roles = ctx.state.roles ?? (await getRolesForUser(db, ctx.from.id));
    const status = getStatusDisplay(roles);

    switch (status.code) {
      case 'preapproved':
      case 'admin':
      case 'super':
      case 'alumni':
        await ctx.reply(`${status.emoji} ${status.text}. Используй /buy для покупки доступа.`);
        return;
      case 'pending':
        await ctx.reply('⏳ Твоя заявка на рассмотрении.', pendingMenu());
        return;
      case 'rejected':
        await ctx.reply('🙅 Твоя предыдущая заявка отклонена. Можешь подать заново.', startMenuForNewbie());
        return;
      case 'banned':
      case 'selfBanned':
        // No menu; quietly refuse.
        return;
      case 'newbie':
      default:
        await ctx.reply('👋 Привет! Это закрытый бот.', startMenuForNewbie());
    }
  });

  router.on(onboardingCallback, async (ctx, payload) => {
    if (!ctx.from) {
      await ctx.answerCbQuery?.();
      return;
    }
    switch (payload.a) {
      case 'onAbout':
        await ctx.editMessageText(ABOUT_TEXT, aboutMenu());
        await ctx.answerCbQuery?.();
        break;
      case 'onCancel':
        await ctx.editMessageText('Главный экран.', startMenuForNewbie());
        await ctx.answerCbQuery?.();
        break;
      case 'onApplyStart':
        await ctx.answerCbQuery?.();
        await (ctx as unknown as Scenes.SceneContext).scene.enter(ONBOARDING_SCENE_ID);
        break;
    }
  });
}
```

### Step 2: Commit

```bash
npm run typecheck
git add src/features/onboarding/routes.ts
git commit -m "feat(features/onboarding): /start command and user callbacks"
```

---

## Task 8: `src/features/onboarding/admin/*.ts`

**Files:**
- Create: `src/features/onboarding/admin/menus.ts`
- Create: `src/features/onboarding/admin/list-routes.ts`
- Create: `src/features/onboarding/admin/single-user-routes.ts`
- Create: `src/features/onboarding/admin/index.ts`

### Step 1: `admin/menus.ts`

```typescript
import { Markup } from 'telegraf';

import { adminFilterRow, adminListItemButton, adminPagination } from '../menus';
import type { ApplicationRow } from '../repo';
import { getStatusDisplay } from '../../../shared/user-status';

export const PAGE_SIZE = 10;

export function listScreen(
  apps: readonly ApplicationRow[],
  page: number,
  totalCount: number,
): { text: string; keyboard: ReturnType<typeof Markup.inlineKeyboard> } {
  const text = apps.length === 0
    ? 'Заявок не найдено.'
    : `Заявок: ${totalCount}. Стр. ${page + 1}.`;

  const rows: ReturnType<typeof Markup.button.callback>[][] = [];
  for (const app of apps) {
    rows.push([adminListItemButton(app)]);
  }
  rows.push(adminFilterRow());
  const pagination = adminPagination(page, (page + 1) * PAGE_SIZE < totalCount);
  if (pagination.length > 0) rows.push(pagination);

  return { text, keyboard: Markup.inlineKeyboard(rows) };
}

export function userCard(app: ApplicationRow, roles: readonly string[]): string {
  const display = getStatusDisplay(roles);
  const name = [app.firstName, app.lastName].filter(Boolean).join(' ') || '—';
  return [
    `<b>Заявка #${app.id}</b>`,
    `${display.emoji} ${display.text}`,
    '',
    `Пользователь: ${app.username ? `@${app.username}` : `id:${app.userId}`}`,
    `Имя: ${name}`,
    `Создана: ${app.createdAt.toLocaleString('ru-RU')}`,
    `Статус заявки: ${app.status}`,
  ].join('\n');
}
```

### Step 2: `admin/list-routes.ts`

```typescript
import { router } from '../../../core/router';
import { db } from '../../../db/client';
import { requireRoles } from '../../../core/permissions';
import type { Telegraf } from 'telegraf';

import { countApplications, listApplications, type ApplicationStatus } from '../repo';
import { onboardingAdminCallback } from '../schemas';

import { listScreen, PAGE_SIZE } from './menus';

const ADMIN_ROLES = ['admin', 'adminPlus', 'super'] as const;

async function renderList(
  ctx: Parameters<typeof onboardingAdminCallback.parse>[0] extends never ? never : Parameters<Telegraf['use']>[0] extends never ? never : never,
  // Hand-roll the ctx type — Telegraf v4's Context typing is fine for our purposes.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): never {
  throw new Error('placeholder'); // overwritten below
}

export function registerAdminListRoutes(bot: Telegraf): void {
  bot.command('applications', requireRoles(...ADMIN_ROLES), async (ctx) => {
    const page = 0;
    const apps = await listApplications(db, { status: 'pending', limit: PAGE_SIZE, offset: 0 });
    const total = await countApplications(db, { status: 'pending' });
    const { text, keyboard } = listScreen(apps, page, total);
    await ctx.reply(text, { parse_mode: 'HTML', ...keyboard });
  });

  router.on(onboardingAdminCallback, async (ctx, payload) => {
    const roles = ctx.state.roles ?? [];
    if (!ADMIN_ROLES.some((r) => roles.includes(r))) {
      await ctx.answerCbQuery?.('Нет прав');
      return;
    }

    switch (payload.a) {
      case 'onAdminList':
      case 'onAdminBack': {
        const page = payload.page;
        const apps = await listApplications(db, { status: 'pending', limit: PAGE_SIZE, offset: page * PAGE_SIZE });
        const total = await countApplications(db, { status: 'pending' });
        const { text, keyboard } = listScreen(apps, page, total);
        await ctx.editMessageText(text, { parse_mode: 'HTML', ...keyboard });
        await ctx.answerCbQuery?.();
        break;
      }
      case 'onAdminFilter': {
        const status: ApplicationStatus = payload.status;
        const page = payload.page;
        const apps = await listApplications(db, { status, limit: PAGE_SIZE, offset: page * PAGE_SIZE });
        const total = await countApplications(db, { status });
        const { text, keyboard } = listScreen(apps, page, total);
        await ctx.editMessageText(text, { parse_mode: 'HTML', ...keyboard });
        await ctx.answerCbQuery?.();
        break;
      }
      // 'onAdminView', 'onAdminApprove', 'onAdminReject' handled in single-user-routes
      default:
        break;
    }
  });
}
```

NOTE: drop the `renderList` placeholder function and its convoluted ctx-type comment from the implementation. It was a thought-experiment artifact. Cleaned implementation should only have `registerAdminListRoutes`.

### Step 3: `admin/single-user-routes.ts`

```typescript
import { router } from '../../../core/router';
import { db } from '../../../db/client';
import { logger } from '../../../core/observability';
import { getRolesForUser } from '../../../db/repos/user-roles';

import { adminViewKeyboard } from '../menus';
import { getApplicationById } from '../repo';
import { approve, reject } from '../service';
import { onboardingAdminCallback } from '../schemas';

import { userCard } from './menus';

const ADMIN_ROLES = ['admin', 'adminPlus', 'super'];

export function registerAdminSingleUserRoutes(): void {
  router.on(onboardingAdminCallback, async (ctx, payload) => {
    const roles = ctx.state.roles ?? [];
    if (!ADMIN_ROLES.some((r) => roles.includes(r))) {
      // List-routes already handles the unauthorized case; only act on view/approve/reject here.
      return;
    }

    switch (payload.a) {
      case 'onAdminView': {
        const app = await getApplicationById(db, payload.id);
        if (!app) {
          await ctx.answerCbQuery?.('Заявка не найдена');
          return;
        }
        const userRoles = await getRolesForUser(db, app.userId);
        await ctx.editMessageText(userCard(app, userRoles), {
          parse_mode: 'HTML',
          ...adminViewKeyboard(app, 0),
        });
        await ctx.answerCbQuery?.();
        break;
      }
      case 'onAdminApprove': {
        if (!ctx.from) break;
        const result = await approve(payload.id, ctx.from.id);
        switch (result) {
          case 'approved':
            await ctx.answerCbQuery?.('Одобрено');
            await ctx.editMessageText('✅ Заявка одобрена.');
            break;
          case 'not_pending':
            await ctx.answerCbQuery?.('Не в статусе pending');
            break;
          case 'not_found':
            await ctx.answerCbQuery?.('Не найдено');
            break;
        }
        break;
      }
      case 'onAdminReject': {
        if (!ctx.from) break;
        const result = await reject(payload.id, ctx.from.id);
        switch (result) {
          case 'rejected':
            await ctx.answerCbQuery?.('Отклонено');
            await ctx.editMessageText('🙅 Заявка отклонена.');
            break;
          case 'not_pending':
            await ctx.answerCbQuery?.('Не в статусе pending');
            break;
          case 'not_found':
            await ctx.answerCbQuery?.('Не найдено');
            break;
        }
        break;
      }
      default:
        // Fall through; list-routes handles the rest.
        break;
    }

    logger.debug({ payload }, 'onboarding admin route');
  });
}
```

NOTE: Both `list-routes.ts` and `single-user-routes.ts` register handlers on the SAME `onboardingAdminCallback` schema. The router would normally reject double-registration. To avoid that, the cleanest approach is to register the schema ONCE in `admin/index.ts` and dispatch internally. Refactor accordingly:

### Step 4: `admin/index.ts` (router-registers once, dispatches to specialized handlers)

```typescript
import type { Telegraf } from 'telegraf';

import { logger } from '../../../core/observability';
import { router } from '../../../core/router';
import { db } from '../../../db/client';
import { getRolesForUser } from '../../../db/repos/user-roles';
import { requireRoles } from '../../../core/permissions';

import { adminViewKeyboard } from '../menus';
import { countApplications, getApplicationById, listApplications, type ApplicationStatus } from '../repo';
import { onboardingAdminCallback } from '../schemas';
import { approve, reject } from '../service';

import { listScreen, PAGE_SIZE, userCard } from './menus';

const ADMIN_ROLES = ['admin', 'adminPlus', 'super'] as const;

export function registerOnboardingAdmin(bot: Telegraf): void {
  bot.command('applications', requireRoles(...ADMIN_ROLES), async (ctx) => {
    const page = 0;
    const apps = await listApplications(db, { status: 'pending', limit: PAGE_SIZE, offset: 0 });
    const total = await countApplications(db, { status: 'pending' });
    const { text, keyboard } = listScreen(apps, page, total);
    await ctx.reply(text, { parse_mode: 'HTML', ...keyboard });
  });

  router.on(onboardingAdminCallback, async (ctx, payload) => {
    if (!ctx.from) {
      await ctx.answerCbQuery?.();
      return;
    }
    const roles = ctx.state.roles ?? [];
    if (!ADMIN_ROLES.some((r) => roles.includes(r))) {
      await ctx.answerCbQuery?.('Нет прав');
      return;
    }

    try {
      switch (payload.a) {
        case 'onAdminList':
        case 'onAdminBack': {
          const page = payload.page;
          const apps = await listApplications(db, { status: 'pending', limit: PAGE_SIZE, offset: page * PAGE_SIZE });
          const total = await countApplications(db, { status: 'pending' });
          const { text, keyboard } = listScreen(apps, page, total);
          await ctx.editMessageText(text, { parse_mode: 'HTML', ...keyboard });
          await ctx.answerCbQuery?.();
          break;
        }
        case 'onAdminFilter': {
          const status: ApplicationStatus = payload.status;
          const page = payload.page;
          const apps = await listApplications(db, { status, limit: PAGE_SIZE, offset: page * PAGE_SIZE });
          const total = await countApplications(db, { status });
          const { text, keyboard } = listScreen(apps, page, total);
          await ctx.editMessageText(text, { parse_mode: 'HTML', ...keyboard });
          await ctx.answerCbQuery?.();
          break;
        }
        case 'onAdminView': {
          const app = await getApplicationById(db, payload.id);
          if (!app) {
            await ctx.answerCbQuery?.('Не найдено');
            break;
          }
          const userRoles = await getRolesForUser(db, app.userId);
          await ctx.editMessageText(userCard(app, userRoles), {
            parse_mode: 'HTML',
            ...adminViewKeyboard(app, 0),
          });
          await ctx.answerCbQuery?.();
          break;
        }
        case 'onAdminApprove': {
          const result = await approve(payload.id, ctx.from.id);
          await ctx.answerCbQuery?.(result === 'approved' ? 'Одобрено' : `Status: ${result}`);
          if (result === 'approved') await ctx.editMessageText('✅ Одобрено.');
          break;
        }
        case 'onAdminReject': {
          const result = await reject(payload.id, ctx.from.id);
          await ctx.answerCbQuery?.(result === 'rejected' ? 'Отклонено' : `Status: ${result}`);
          if (result === 'rejected') await ctx.editMessageText('🙅 Отклонено.');
          break;
        }
      }
    } catch (err) {
      logger.error({ err, payload }, 'onboarding admin route failed');
      await ctx.answerCbQuery?.('Ошибка');
    }
  });
}
```

**Drop the `list-routes.ts` and `single-user-routes.ts` files** — the consolidated `admin/index.ts` above replaces them. The split-into-two pattern from the spec is dropped because of the single-schema-single-registration constraint in the typed router. Implementer: do not create those two files; create only `admin/menus.ts` and `admin/index.ts`.

### Step 5: Commit

```bash
mkdir -p src/features/onboarding/admin
# write menus.ts and index.ts (skipping the obsolete list-routes / single-user-routes)
npm run typecheck
git add src/features/onboarding/admin/
git commit -m "feat(features/onboarding/admin): list + approve/reject (single typed router slot)"
```

---

## Task 9: `src/features/onboarding/index.ts`

**Files:**
- Create: `src/features/onboarding/index.ts`

```typescript
import type { Telegraf } from 'telegraf';

import { registerOnboardingAdmin } from './admin';
import { registerOnboardingCommands } from './routes';

export { onboardingScene, ONBOARDING_SCENE_ID } from './scene';
export { submit, approve, reject } from './service';

export function register(bot: Telegraf): void {
  registerOnboardingCommands(bot);
  registerOnboardingAdmin(bot);
}
```

Commit:

```bash
git add src/features/onboarding/index.ts
git commit -m "feat(features/onboarding): public surface"
```

---

## Task 10: Integration test + wire-up

**Files:**
- Create: `tests/integration/onboarding.repo.test.ts`
- Modify: `src/index.ts`

### Step 1: Integration test

```typescript
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Knex } from 'knex';

import {
  countApplications,
  getApplicationById,
  getApplicationByUserId,
  insertApplication,
  listApplications,
  setApplicationStatus,
} from '../../src/features/onboarding/repo';
import { setupTestDb } from './setup';

describe('onboarding.repo', () => {
  let db: Knex;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    ({ db, cleanup } = await setupTestDb());
    await db.migrate.latest();
    await db('users').insert({ id: 1, username: 'u1', first_name: 'Alice' });
  });

  afterEach(async () => {
    await cleanup();
  });

  it('insertApplication + getApplicationByUserId round-trips', async () => {
    const id = await insertApplication(db, {
      userId: 1,
      username: 'u1',
      firstName: 'Alice',
      lastName: null,
    });
    const app = await getApplicationByUserId(db, 1);
    expect(app?.id).toBe(id);
    expect(app?.status).toBe('pending');
  });

  it('setApplicationStatus updates and updated_at', async () => {
    const id = await insertApplication(db, { userId: 1, username: 'u1', firstName: 'A', lastName: null });
    await setApplicationStatus(db, id, 'approved');
    const app = await getApplicationById(db, id);
    expect(app?.status).toBe('approved');
  });

  it('listApplications + countApplications filter by status', async () => {
    await insertApplication(db, { userId: 1, username: 'u1', firstName: 'A', lastName: null });
    expect(await countApplications(db, { status: 'pending' })).toBe(1);
    expect(await countApplications(db, { status: 'approved' })).toBe(0);

    const list = await listApplications(db, { status: 'pending' });
    expect(list).toHaveLength(1);
  });
});
```

Commit:

```bash
git add tests/integration/onboarding.repo.test.ts
git commit -m "test(integration): onboarding repo"
```

### Step 2: Wire into `src/index.ts`

```typescript
import * as onboardingFeature from './features/onboarding';

// inside main(), extend the combined stage:
const combinedStage = new Scenes.Stage<Scenes.SceneContext>([
  ...Array.from(createRaidStage().scenes.values()),
  ...getKickstarterScenes(),
  paymentsFeature.sbpScene,
  onboardingFeature.onboardingScene,
]);
bot.use(combinedStage.middleware());

// after the other feature register calls:
onboardingFeature.register(bot);
```

Pipeline check:

```bash
npm run gen:locale-types && npm run lint && npm run typecheck && npx vitest run "src/**/*.test.ts" && npm run build && ls dist/
```

Commit:

```bash
git add src/index.ts
git commit -m "feat(core): register onboarding feature with linear scene"
```

---

## Self-review checklist

- [ ] `getStatusDisplay` is the only function that maps roles to display — no inline `if (roles.includes('admin'))` chains in any feature.
- [ ] `onboardingScene` is a single linear scene — no jump-backs to "intro" from inside the confirm screen.
- [ ] `submit/approve/reject` in `onboarding/service.ts` are the only places that mutate `applications.status`.
- [ ] `addRole`/`removeRole`/`replaceRole` in `db/repos/user-roles-mutations.ts` are the only writes to `user_roles`.
- [ ] `npm test` passes; admin list/approve flow has integration test coverage.
- [ ] Build green; `dist/index.js` at top level.

---

## What's next

Plan 10 — Invitations (renamed `archive/` → `invitations/`). Single source for invitation link lifecycle: create on approval+payment, mark used on join, revoke on expiry. Replaces the buggy `revokeInvitationLink` legacy call (which passed `groupPeriod` instead of the URL) and consolidates the two legacy invitation-link helpers.
