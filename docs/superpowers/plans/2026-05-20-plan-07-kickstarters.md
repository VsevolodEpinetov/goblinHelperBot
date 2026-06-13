# Plan 07 — Kickstarters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `src/features/kickstarters/` — browse the catalogue, view a single item with photos/price, redeem via a scroll (transactional + idempotent using `useScrollInTrx` from Plan 05), admin CRUD with a single `makeEditFieldScene` factory replacing the four near-identical edit scenes the audit found, and one canonical `sendKickstarterPromo` replacing the two divergent legacy implementations.

**Architecture:** Standard `src/features/<x>/` folder shape. The purchase paths split into two services: `purchaseWithScroll` lands in this plan; `purchaseWithStars` defers to Plan 08 (it shares the payment-tracking + pre-checkout pattern with subscriptions and is naturally co-designed there). The edit-field scene factory is the centrepiece of the admin side — one function generates all four scenes from a config.

**Tech Stack:** TypeScript, Telegraf v4 + Scenes, knex, Vitest, zod.

**Spec reference:** §4.5 of `docs/superpowers/specs/2026-05-17-bot-greenfield-rewrite-design.md`.

**Prerequisites:** Plans 01–06 complete. After migration 018 the kickstarter tables are snake_case. `loyalty/scrolls/useScrollInTrx` is the canonical scroll-spend; `loyalty/grantXp` is the canonical XP grant.

**Out of scope:**
- Stars-based purchases (Plan 08 — they integrate with `pre_checkout_query` and `successful_payment`).
- Notification webhook from external Kickstarter campaigns (not part of this bot's roadmap).

---

## File Structure

**Created under `src/features/kickstarters/`:**
- `repo.ts`
- `format.ts` + `format.test.ts`
- `service.ts` + `service.test.ts`
- `schemas.ts`
- `menus.ts`
- `promo.ts`
- `scenes/edit-field.ts` (the factory)
- `scenes/add-chain.ts` (chain definition for the multi-step add wizard)
- `scenes/add/name.ts`, `creator.ts`, `link.ts`, `cost.ts`, `pledge-name.ts`, `pledge-cost.ts`, `photos.ts`, `files.ts`, `review.ts`
- `actions.ts`
- `routes.ts`
- `admin-routes.ts`
- `index.ts`

**Created (integration test):**
- `tests/integration/kickstarters.repo.test.ts`

**Modified:**
- `src/index.ts` — register feature + extend the Scenes Stage with kickstarter scenes

---

## Task 1: `src/features/kickstarters/repo.ts`

**Files:**
- Create: `src/features/kickstarters/repo.ts`

Schemas (post-migration-018 snake_case):
- `kickstarters(id, name, creator, cost, pledge_name, pledge_cost, link, created_at)`
- `kickstarter_photos(id, kickstarter_id, ord, file_id, created_at, updated_at)`
- `kickstarter_files(id, kickstarter_id, ord, file_id, created_at, updated_at)`
- `user_kickstarters(user_id, kickstarter_id)` — junction

### Step 1: Implement

```typescript
import type { DbConn } from '../../db/client';

export interface KickstarterRow {
  id: number;
  name: string;
  creator: string | null;
  cost: number;
  pledgeName: string | null;
  pledgeCost: number | null;
  link: string | null;
  createdAt: Date;
}

export interface KickstarterAsset {
  ord: number;
  fileId: string;
}

function rowToKickstarter(row: Record<string, unknown> | undefined): KickstarterRow | undefined {
  if (!row) return undefined;
  return {
    id: row.id as number,
    name: row.name as string,
    creator: (row.creator as string | null) ?? null,
    cost: Number(row.cost),
    pledgeName: (row.pledge_name as string | null) ?? null,
    pledgeCost: row.pledge_cost == null ? null : Number(row.pledge_cost),
    link: (row.link as string | null) ?? null,
    createdAt: row.created_at as Date,
  };
}

export async function listKickstarters(conn: DbConn): Promise<KickstarterRow[]> {
  const rows = await conn('kickstarters').orderBy('created_at', 'desc');
  return rows.map(rowToKickstarter) as KickstarterRow[];
}

export async function getKickstarterById(
  conn: DbConn,
  id: number,
): Promise<KickstarterRow | undefined> {
  const row = await conn('kickstarters').where('id', id).first();
  return rowToKickstarter(row);
}

export async function getKickstarterPhotos(
  conn: DbConn,
  kickstarterId: number,
): Promise<KickstarterAsset[]> {
  const rows = await conn('kickstarter_photos')
    .where('kickstarter_id', kickstarterId)
    .orderBy('ord', 'asc');
  return rows.map((r: { ord: number; file_id: string }) => ({ ord: r.ord, fileId: r.file_id }));
}

export async function getKickstarterFiles(
  conn: DbConn,
  kickstarterId: number,
): Promise<KickstarterAsset[]> {
  const rows = await conn('kickstarter_files')
    .where('kickstarter_id', kickstarterId)
    .orderBy('ord', 'asc');
  return rows.map((r: { ord: number; file_id: string }) => ({ ord: r.ord, fileId: r.file_id }));
}

export interface CreateKickstarterInput {
  name: string;
  creator: string | null;
  cost: number;
  pledgeName: string | null;
  pledgeCost: number | null;
  link: string | null;
  photoFileIds: string[];
  fileFileIds: string[];
}

/** Create kickstarter + its photos and files. Returns the new id. */
export async function createKickstarter(
  conn: DbConn,
  input: CreateKickstarterInput,
): Promise<number> {
  const [row] = await conn('kickstarters')
    .insert({
      name: input.name,
      creator: input.creator,
      cost: input.cost,
      pledge_name: input.pledgeName,
      pledge_cost: input.pledgeCost,
      link: input.link,
    })
    .returning('id');
  const id: number = row.id;

  if (input.photoFileIds.length > 0) {
    await conn('kickstarter_photos').insert(
      input.photoFileIds.map((fileId, idx) => ({
        kickstarter_id: id,
        ord: idx + 1,
        file_id: fileId,
      })),
    );
  }
  if (input.fileFileIds.length > 0) {
    await conn('kickstarter_files').insert(
      input.fileFileIds.map((fileId, idx) => ({
        kickstarter_id: id,
        ord: idx + 1,
        file_id: fileId,
      })),
    );
  }
  return id;
}

/** Allowed field updates (whitelist to prevent SQL-via-column-name shenanigans). */
export type EditableField = 'name' | 'creator' | 'cost' | 'pledge_name' | 'pledge_cost' | 'link';

const EDITABLE_FIELDS: ReadonlySet<EditableField> = new Set([
  'name',
  'creator',
  'cost',
  'pledge_name',
  'pledge_cost',
  'link',
]);

export async function updateKickstarterField(
  conn: DbConn,
  id: number,
  field: EditableField,
  value: string | number | null,
): Promise<void> {
  if (!EDITABLE_FIELDS.has(field)) throw new Error(`Field "${field}" is not editable`);
  await conn('kickstarters').where('id', id).update({ [field]: value });
}

export async function hasUserPurchased(
  conn: DbConn,
  userId: number,
  kickstarterId: number,
): Promise<boolean> {
  const row = await conn('user_kickstarters')
    .where({ user_id: userId, kickstarter_id: kickstarterId })
    .first();
  return !!row;
}

/** Insert into user_kickstarters; returns true on insert, false if user already had it. */
export async function recordPurchase(
  conn: DbConn,
  userId: number,
  kickstarterId: number,
): Promise<boolean> {
  try {
    await conn('user_kickstarters').insert({ user_id: userId, kickstarter_id: kickstarterId });
    return true;
  } catch (err) {
    if ((err as { code?: string }).code === '23505') return false;
    throw err;
  }
}

export async function listUserKickstarters(
  conn: DbConn,
  userId: number,
): Promise<KickstarterRow[]> {
  const rows = await conn('kickstarters as k')
    .innerJoin('user_kickstarters as uk', 'uk.kickstarter_id', 'k.id')
    .where('uk.user_id', userId)
    .orderBy('k.created_at', 'desc')
    .select('k.*');
  return rows.map(rowToKickstarter) as KickstarterRow[];
}
```

### Step 2: Commit

```bash
mkdir -p src/features/kickstarters
# write repo.ts
npm run typecheck
git add src/features/kickstarters/repo.ts
git commit -m "feat(features/kickstarters): repository (kickstarters + photos + files + purchases)"
```

---

## Task 2: `src/features/kickstarters/format.ts` (TDD)

**Files:**
- Create: `src/features/kickstarters/format.ts`
- Create: `src/features/kickstarters/format.test.ts`

### Step 1: Test

```typescript
import { describe, expect, it } from 'vitest';

import { formatKickstarterCard, formatKickstarterShort } from './format';

const base = {
  id: 7,
  name: 'Acme Mech',
  creator: 'Acme',
  cost: 1500,
  pledgeName: 'Bronze Tier',
  pledgeCost: 800,
  link: 'https://example.com',
};

describe('kickstarters.format', () => {
  it('formatKickstarterCard includes the name and cost', () => {
    const text = formatKickstarterCard(base);
    expect(text).toContain('Acme Mech');
    expect(text).toContain('1500');
  });

  it('formatKickstarterCard includes creator and link', () => {
    const text = formatKickstarterCard(base);
    expect(text).toContain('Acme');
    expect(text).toContain('example.com');
  });

  it('formatKickstarterCard omits link section when missing', () => {
    const text = formatKickstarterCard({ ...base, link: null });
    expect(text).not.toContain('🔗');
  });

  it('formatKickstarterCard shows pledge data when present', () => {
    const text = formatKickstarterCard(base);
    expect(text).toContain('Bronze Tier');
    expect(text).toContain('800');
  });

  it('formatKickstarterCard omits pledge section when missing', () => {
    const text = formatKickstarterCard({ ...base, pledgeName: null, pledgeCost: null });
    expect(text).not.toContain('Pledge');
  });

  it('formatKickstarterShort one-liner', () => {
    expect(formatKickstarterShort(base)).toMatch(/#7.*Acme Mech.*1500/);
  });
});
```

### Step 2: Implement

```typescript
import { escapeHtml } from '../../shared/format';

import type { KickstarterRow } from './repo';

export function formatKickstarterCard(
  ks: Pick<KickstarterRow, 'id' | 'name' | 'creator' | 'cost' | 'pledgeName' | 'pledgeCost' | 'link'>,
): string {
  const lines: string[] = [];
  lines.push(`<b>${escapeHtml(ks.name)}</b> (#${ks.id})`);
  if (ks.creator) lines.push(`👤 ${escapeHtml(ks.creator)}`);
  lines.push(`💰 ${ks.cost} ⭐`);
  if (ks.pledgeName && ks.pledgeCost !== null) {
    lines.push('');
    lines.push(`<b>Pledge: ${escapeHtml(ks.pledgeName)}</b>`);
    lines.push(`💰 ${ks.pledgeCost} ⭐`);
  }
  if (ks.link) {
    lines.push('');
    lines.push(`🔗 ${escapeHtml(ks.link)}`);
  }
  return lines.join('\n');
}

export function formatKickstarterShort(ks: Pick<KickstarterRow, 'id' | 'name' | 'cost'>): string {
  return `#${ks.id} — ${ks.name} (${ks.cost} ⭐)`;
}
```

### Step 3: Run + commit

```bash
npx vitest run src/features/kickstarters/format.test.ts
git add src/features/kickstarters/format.ts src/features/kickstarters/format.test.ts
git commit -m "feat(features/kickstarters): card and short-line formatters"
```

---

## Task 3: `src/features/kickstarters/service.ts` (scroll purchase, TDD pure parts)

**Files:**
- Create: `src/features/kickstarters/service.ts`
- Create: `src/features/kickstarters/service.test.ts`

### Step 1: Test (pure logic only — validation helpers)

```typescript
import { describe, expect, it } from 'vitest';

import { validateName, validateCost, validateLink } from './service';

describe('kickstarters.service.validateName', () => {
  it('trims and returns', () => {
    expect(validateName('  Foo  ')).toBe('Foo');
  });
  it('throws on empty', () => {
    expect(() => validateName('')).toThrow();
  });
  it('throws on too long', () => {
    expect(() => validateName('a'.repeat(300))).toThrow();
  });
});

describe('kickstarters.service.validateCost', () => {
  it('parses integers and returns positive numbers', () => {
    expect(validateCost('1500')).toBe(1500);
  });
  it('rejects non-numeric', () => {
    expect(() => validateCost('abc')).toThrow();
  });
  it('rejects negative', () => {
    expect(() => validateCost('-1')).toThrow();
  });
  it('rejects zero', () => {
    expect(() => validateCost('0')).toThrow();
  });
});

describe('kickstarters.service.validateLink', () => {
  it('accepts http(s) URLs', () => {
    expect(validateLink('https://example.com')).toBe('https://example.com');
  });
  it('treats "пропустить" as null', () => {
    expect(validateLink('пропустить')).toBeNull();
  });
  it('rejects non-URL strings', () => {
    expect(() => validateLink('not-a-url')).toThrow();
  });
});
```

### Step 2: Implement

```typescript
import { db, type DbConn } from '../../db/client';
import { logger } from '../../core/observability';
import { grantXpInTrx } from '../loyalty';
import { useScrollInTrx, InsufficientScrollsError } from '../scrolls';

import {
  getKickstarterById,
  getKickstarterFiles,
  hasUserPurchased,
  recordPurchase,
  type EditableField,
  type KickstarterRow,
} from './repo';

export const XP_FOR_KICKSTARTER_PURCHASE = 300;
const NAME_MAX = 255;

export function validateName(input: string): string {
  const t = input.trim();
  if (t.length === 0) throw new Error('Имя не может быть пустым');
  if (t.length > NAME_MAX) throw new Error(`Имя должно быть до ${NAME_MAX} символов`);
  return t;
}

export function validateCost(input: string): number {
  const n = Number(String(input).replace(',', '.').trim());
  if (!Number.isFinite(n)) throw new Error('Стоимость должна быть числом');
  if (n <= 0) throw new Error('Стоимость должна быть положительной');
  return Math.round(n);
}

export function validateLink(input: string): string | null {
  const t = input.trim();
  if (/^пропустить$/i.test(t)) return null;
  if (!/^https?:\/\//i.test(t)) throw new Error('Ссылка должна начинаться с http:// или https://');
  return t;
}

export type PurchaseScrollResult =
  | { status: 'purchased'; kickstarter: KickstarterRow; fileIds: string[] }
  | { status: 'already_owned'; kickstarter: KickstarterRow; fileIds: string[] }
  | { status: 'not_found' }
  | { status: 'insufficient_scrolls'; scrollId: string; required: number; available: number };

/**
 * Atomic kickstarter redemption using a scroll.
 *
 * - Throws nothing on the "predictable" failure modes (not_found, already_owned, insufficient).
 * - Idempotent: a second call after `purchased` returns `already_owned`.
 * - Grants XP idempotently via `external_id = 'ks:<id>:user:<userId>'`.
 */
export async function purchaseWithScroll(input: {
  userId: number;
  kickstarterId: number;
  scrollId: string;
}): Promise<PurchaseScrollResult> {
  return db.transaction(async (trx): Promise<PurchaseScrollResult> => {
    const ks = await getKickstarterById(trx, input.kickstarterId);
    if (!ks) return { status: 'not_found' };

    if (await hasUserPurchased(trx, input.userId, input.kickstarterId)) {
      const fileIds = (await getKickstarterFiles(trx, input.kickstarterId)).map((f) => f.fileId);
      return { status: 'already_owned', kickstarter: ks, fileIds };
    }

    try {
      await useScrollInTrx(trx, input.userId, input.scrollId, 1, `kickstarter:${input.kickstarterId}`);
    } catch (err) {
      if (err instanceof InsufficientScrollsError) {
        return {
          status: 'insufficient_scrolls',
          scrollId: err.scrollId,
          required: err.required,
          available: err.available,
        };
      }
      throw err;
    }

    await recordPurchase(trx, input.userId, input.kickstarterId);
    try {
      await grantXpInTrx(trx, {
        userId: input.userId,
        amount: XP_FOR_KICKSTARTER_PURCHASE,
        source: 'kickstarter_purchase',
        externalId: `ks:${input.kickstarterId}:user:${input.userId}`,
      });
    } catch (err) {
      logger.warn({ err, userId: input.userId, kickstarterId: input.kickstarterId }, 'kickstarter purchase: grantXp failed');
    }

    const fileIds = (await getKickstarterFiles(trx, input.kickstarterId)).map((f) => f.fileId);
    return { status: 'purchased', kickstarter: ks, fileIds };
  });
}

export async function updateField(
  id: number,
  field: EditableField,
  value: string | number | null,
): Promise<void> {
  // Direct repo call kept for symmetry; future logic (e.g., re-publish promo) hooks here.
  const { updateKickstarterField } = await import('./repo');
  await updateKickstarterField(db, id, field, value);
}

export type { DbConn };
```

### Step 3: Run + commit

```bash
npx vitest run src/features/kickstarters/service.test.ts
git add src/features/kickstarters/service.ts src/features/kickstarters/service.test.ts
git commit -m "feat(features/kickstarters): scroll-purchase service + validators"
```

---

## Task 4: `src/features/kickstarters/schemas.ts` and `menus.ts`

**Files:**
- Create: `src/features/kickstarters/schemas.ts`
- Create: `src/features/kickstarters/menus.ts`

### Step 1: `schemas.ts`

```typescript
import { z } from 'zod';

export const ksCallback = z.discriminatedUnion('a', [
  z.object({ a: z.literal('ksList') }),
  z.object({ a: z.literal('ksView'), id: z.number().int() }),
  z.object({ a: z.literal('ksBuyScroll'), id: z.number().int() }),
  z.object({ a: z.literal('ksEdit'), id: z.number().int(), f: z.enum(['name', 'creator', 'cost', 'pledge_name', 'pledge_cost', 'link']) }),
  z.object({ a: z.literal('ksAdminMenu'), id: z.number().int() }),
]);

export type KsCallback = z.infer<typeof ksCallback>;
```

### Step 2: `menus.ts`

```typescript
import { Markup } from 'telegraf';

import { router } from '../../core/router';

import type { KickstarterRow } from './repo';
import { ksCallback } from './schemas';

/** Pick a scroll the user wants to spend; assume one default scroll id "kickstarter" for v2. */
const DEFAULT_SCROLL_ID = 'kickstarter';

export function userViewKeyboard(ks: Pick<KickstarterRow, 'id'>, alreadyOwned: boolean): ReturnType<typeof Markup.inlineKeyboard> {
  if (alreadyOwned) {
    return Markup.inlineKeyboard([]);
  }
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        '🎟 Использовать свиток',
        router.encode(ksCallback, { a: 'ksBuyScroll', id: ks.id }),
      ),
    ],
  ]);
}

export function adminEditKeyboard(ks: Pick<KickstarterRow, 'id'>): ReturnType<typeof Markup.inlineKeyboard> {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('✏️ Имя', router.encode(ksCallback, { a: 'ksEdit', id: ks.id, f: 'name' })),
      Markup.button.callback('✏️ Автор', router.encode(ksCallback, { a: 'ksEdit', id: ks.id, f: 'creator' })),
    ],
    [
      Markup.button.callback('✏️ Цена', router.encode(ksCallback, { a: 'ksEdit', id: ks.id, f: 'cost' })),
      Markup.button.callback('✏️ Ссылка', router.encode(ksCallback, { a: 'ksEdit', id: ks.id, f: 'link' })),
    ],
    [
      Markup.button.callback('✏️ Пледж', router.encode(ksCallback, { a: 'ksEdit', id: ks.id, f: 'pledge_name' })),
      Markup.button.callback('✏️ Цена пледжа', router.encode(ksCallback, { a: 'ksEdit', id: ks.id, f: 'pledge_cost' })),
    ],
  ]);
}

export { DEFAULT_SCROLL_ID };
```

### Step 3: Commit

```bash
npm run typecheck
git add src/features/kickstarters/schemas.ts src/features/kickstarters/menus.ts
git commit -m "feat(features/kickstarters): callback schemas and keyboards"
```

---

## Task 5: The `makeEditFieldScene` factory + add-wizard chain

**Files:**
- Create: `src/features/kickstarters/scenes/edit-field.ts`
- Create: `src/features/kickstarters/scenes/add-chain.ts`
- Create: `src/features/kickstarters/scenes/add/name.ts`, `creator.ts`, `link.ts`, `cost.ts`, `pledge-name.ts`, `pledge-cost.ts`, `photos.ts`, `files.ts`, `review.ts`

### Step 1: `scenes/edit-field.ts` — the factory

```typescript
import { Scenes } from 'telegraf';

import { logger } from '../../../core/observability';
import { updateField } from '../service';
import type { EditableField } from '../repo';

export type Validator = (input: string) => string | number | null;

export interface EditFieldConfig {
  /** Scene id, e.g., `ks:edit:name`. */
  id: string;
  /** DB column name to update. */
  field: EditableField;
  /** User-visible prompt. */
  prompt: string;
  /** Throws on invalid input. Returns the value to write (string, number, or null). */
  validate: Validator;
}

/**
 * One factory that replaces the four near-identical edit scenes in the legacy code.
 * Each call returns a Telegraf scene whose only state is `{ kickstarterId: number }`.
 */
export function makeEditFieldScene(config: EditFieldConfig): Scenes.BaseScene<Scenes.SceneContext> {
  const scene = new Scenes.BaseScene<Scenes.SceneContext>(config.id);

  scene.enter(async (ctx) => {
    await ctx.reply(config.prompt);
  });

  scene.command('cancel', async (ctx) => {
    ctx.scene.state = {};
    await ctx.scene.leave();
    await ctx.reply('Отменено.');
  });

  scene.on('text', async (ctx) => {
    const state = ctx.scene.state as { kickstarterId?: number };
    if (!state.kickstarterId) {
      await ctx.reply('Не вижу kickstarter id. Зайди заново через админ-меню.');
      await ctx.scene.leave();
      return;
    }
    try {
      const value = config.validate(ctx.message.text);
      await updateField(state.kickstarterId, config.field, value);
      await ctx.reply(`✅ Обновлено.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Неверный ввод.';
      await ctx.reply(msg);
      logger.debug({ err, field: config.field }, 'edit-field validation failed');
      return; // Stay in scene so user can retry.
    }
    await ctx.scene.leave();
  });

  return scene;
}
```

### Step 2: Instantiate the four edit scenes

```typescript
// src/features/kickstarters/scenes/edit-scenes.ts
import { validateCost, validateLink, validateName } from '../service';

import { makeEditFieldScene } from './edit-field';

export const editNameScene = makeEditFieldScene({
  id: 'ks:edit:name',
  field: 'name',
  prompt: 'Новое имя? Или /cancel.',
  validate: validateName,
});

export const editCreatorScene = makeEditFieldScene({
  id: 'ks:edit:creator',
  field: 'creator',
  prompt: 'Новый автор? Или /cancel.',
  validate: (s) => s.trim(),
});

export const editCostScene = makeEditFieldScene({
  id: 'ks:edit:cost',
  field: 'cost',
  prompt: 'Новая цена (в звёздах)? Или /cancel.',
  validate: validateCost,
});

export const editLinkScene = makeEditFieldScene({
  id: 'ks:edit:link',
  field: 'link',
  prompt: 'Новая ссылка? "пропустить" чтобы убрать. Или /cancel.',
  validate: validateLink,
});

export const editPledgeNameScene = makeEditFieldScene({
  id: 'ks:edit:pledge_name',
  field: 'pledge_name',
  prompt: 'Имя пледжа? "пропустить" для пустого. Или /cancel.',
  validate: (s) => {
    const t = s.trim();
    return /^пропустить$/i.test(t) ? null : t;
  },
});

export const editPledgeCostScene = makeEditFieldScene({
  id: 'ks:edit:pledge_cost',
  field: 'pledge_cost',
  prompt: 'Цена пледжа? "пропустить" для пустого. Или /cancel.',
  validate: (s) => {
    const t = s.trim();
    if (/^пропустить$/i.test(t)) return null;
    return validateCost(t);
  },
});

export const ALL_EDIT_SCENES = [
  editNameScene,
  editCreatorScene,
  editCostScene,
  editLinkScene,
  editPledgeNameScene,
  editPledgeCostScene,
] as const;
```

### Step 3: Add-wizard chain (`scenes/add-chain.ts`)

```typescript
import { defineChain } from '../../../core/scenes';

export const KS_ADD_CHAIN = defineChain([
  'ks:add:name',
  'ks:add:creator',
  'ks:add:link',
  'ks:add:cost',
  'ks:add:pledge-name',
  'ks:add:pledge-cost',
  'ks:add:photos',
  'ks:add:files',
  'ks:add:review',
] as const);

export interface KsAddDraft {
  name?: string;
  creator?: string | null;
  link?: string | null;
  cost?: number;
  pledgeName?: string | null;
  pledgeCost?: number | null;
  photoFileIds?: string[];
  fileFileIds?: string[];
}
```

### Step 4: Add scene files

Each add scene follows the raid scene pattern from Plan 06. **Implement all 9 scenes** with this shape:

`src/features/kickstarters/scenes/add/name.ts`:

```typescript
import { Scenes } from 'telegraf';

import { KS_ADD_CHAIN, type KsAddDraft } from '../add-chain';
import { validateName } from '../../service';

export const nameScene = new Scenes.BaseScene<Scenes.SceneContext>('ks:add:name');

nameScene.enter(async (ctx) => {
  await ctx.reply('Имя нового кикстартера? Или /cancel.');
});

nameScene.command('cancel', async (ctx) => {
  ctx.scene.state = {};
  await ctx.scene.leave();
  await ctx.reply('Отменено.');
});

nameScene.on('text', async (ctx) => {
  try {
    const name = validateName(ctx.message.text);
    const draft = ctx.scene.state as KsAddDraft;
    draft.name = name;
    const next = KS_ADD_CHAIN.nextOf(nameScene.id);
    if (next) await ctx.scene.enter(next, draft as object);
    else await ctx.scene.leave();
  } catch (err) {
    await ctx.reply((err as Error).message);
  }
});
```

Apply the same pattern to the rest. Provided as a concise table — implementer expands each:

| File | Prompt | Persist to draft | Validator |
|---|---|---|---|
| `creator.ts` | "Автор? \"пропустить\" если нет." | `draft.creator` | trim or null on 'пропустить' |
| `link.ts` | "Ссылка? \"пропустить\" если нет." | `draft.link` | `validateLink` |
| `cost.ts` | "Цена в звёздах?" | `draft.cost` | `validateCost` |
| `pledge-name.ts` | "Имя пледжа? \"пропустить\"" | `draft.pledgeName` | trim or null |
| `pledge-cost.ts` | "Цена пледжа? \"пропустить\"" | `draft.pledgeCost` | `validateCost` or null |
| `photos.ts` | Photo collector with "далее" trigger (mirror Plan 06 photo scene) | `draft.photoFileIds: string[]` | n/a |
| `files.ts` | Document collector with "далее" trigger; accept any document | `draft.fileFileIds: string[]` | n/a |
| `review.ts` | Show summary + Confirm/Cancel; on Confirm call `createKickstarter(...)` transactionally, then leave. | n/a (writes DB) | n/a |

The `review.ts` scene closely mirrors `raids/scenes/review.ts`:

```typescript
import { Markup, Scenes } from 'telegraf';

import { db } from '../../../../db/client';
import { logger } from '../../../../core/observability';
import { createKickstarter } from '../../repo';
import type { KsAddDraft } from '../add-chain';

export const reviewScene = new Scenes.BaseScene<Scenes.SceneContext>('ks:add:review');

reviewScene.enter(async (ctx) => {
  const draft = ctx.scene.state as KsAddDraft;
  await ctx.reply(
    `<b>${draft.name ?? ''}</b>\n` +
      `Автор: ${draft.creator ?? '—'}\n` +
      `Цена: ${draft.cost ?? 0} ⭐\n` +
      `Pledge: ${draft.pledgeName ?? '—'} (${draft.pledgeCost ?? '—'} ⭐)\n` +
      `Фото: ${draft.photoFileIds?.length ?? 0}, файлов: ${draft.fileFileIds?.length ?? 0}`,
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback('✅ Создать', 'ks:add:confirm'),
          Markup.button.callback('❌ Отмена', 'ks:add:abort'),
        ],
      ]),
    },
  );
});

reviewScene.action('ks:add:abort', async (ctx) => {
  ctx.scene.state = {};
  await ctx.scene.leave();
  await ctx.editMessageText('Отменено.');
});

reviewScene.action('ks:add:confirm', async (ctx) => {
  const draft = ctx.scene.state as KsAddDraft;
  try {
    const id = await db.transaction((trx) =>
      createKickstarter(trx, {
        name: draft.name ?? '',
        creator: draft.creator ?? null,
        cost: draft.cost ?? 0,
        pledgeName: draft.pledgeName ?? null,
        pledgeCost: draft.pledgeCost ?? null,
        link: draft.link ?? null,
        photoFileIds: draft.photoFileIds ?? [],
        fileFileIds: draft.fileFileIds ?? [],
      }),
    );
    await ctx.editMessageText(`Создан кикстартер #${id}.`);
  } catch (err) {
    logger.error({ err }, 'kickstarter add: createKickstarter failed');
    await ctx.editMessageText('Не удалось создать. Попробуй ещё раз.');
  } finally {
    ctx.scene.state = {};
    await ctx.scene.leave();
  }
});
```

### Step 5: Commits

```bash
mkdir -p src/features/kickstarters/scenes/add
# write edit-field.ts, edit-scenes.ts, add-chain.ts
npm run typecheck
git add src/features/kickstarters/scenes/edit-field.ts src/features/kickstarters/scenes/edit-scenes.ts src/features/kickstarters/scenes/add-chain.ts
git commit -m "feat(features/kickstarters): edit-field factory + add wizard chain"

# write all 9 add scenes
git add src/features/kickstarters/scenes/add/
git commit -m "feat(features/kickstarters): 9-step add wizard scenes"
```

---

## Task 6: `src/features/kickstarters/promo.ts` (single sendKickstarterPromo)

**Files:**
- Create: `src/features/kickstarters/promo.ts`

The legacy bot had two divergent `sendKickstarterPromo`. This is the only one.

### Step 1: Implement

```typescript
import { bot } from '../../core/bot';
import { logger } from '../../core/observability';
import { db } from '../../db/client';

import { formatKickstarterCard } from './format';
import { getKickstarterById, getKickstarterPhotos } from './repo';

/** Post a kickstarter promo to the configured group + topic. Returns the posted message id, or undefined on failure. */
export async function sendKickstarterPromo(
  kickstarterId: number,
  groupChatId: string,
  topicId?: number,
): Promise<number | undefined> {
  const ks = await getKickstarterById(db, kickstarterId);
  if (!ks) {
    logger.warn({ kickstarterId }, 'sendKickstarterPromo: kickstarter not found');
    return undefined;
  }
  const photos = await getKickstarterPhotos(db, kickstarterId);
  try {
    const text = formatKickstarterCard(ks);
    const baseOpts: { parse_mode: 'HTML'; message_thread_id?: number } = { parse_mode: 'HTML' };
    if (topicId !== undefined) baseOpts.message_thread_id = topicId;

    if (photos.length === 0) {
      const msg = await bot.telegram.sendMessage(groupChatId, text, baseOpts);
      return msg.message_id;
    }
    if (photos.length === 1) {
      const msg = await bot.telegram.sendPhoto(groupChatId, photos[0]!.fileId, {
        caption: text,
        ...baseOpts,
      });
      return msg.message_id;
    }
    // 2+ photos: send a media group; first item carries the caption.
    const media = photos.map((p, i) => ({
      type: 'photo' as const,
      media: p.fileId,
      ...(i === 0 ? { caption: text, parse_mode: 'HTML' as const } : {}),
    }));
    const msgs = await bot.telegram.sendMediaGroup(groupChatId, media, baseOpts);
    return msgs[0]?.message_id;
  } catch (err) {
    logger.error({ err, kickstarterId, groupChatId }, 'sendKickstarterPromo: send failed');
    return undefined;
  }
}
```

### Step 2: Commit

```bash
npm run typecheck
git add src/features/kickstarters/promo.ts
git commit -m "feat(features/kickstarters): single canonical sendKickstarterPromo"
```

---

## Task 7: `src/features/kickstarters/actions.ts` and `routes.ts`

**Files:**
- Create: `src/features/kickstarters/actions.ts`
- Create: `src/features/kickstarters/routes.ts`
- Create: `src/features/kickstarters/admin-routes.ts`

### Step 1: `actions.ts` — user-facing view/buy + admin edit dispatch

```typescript
import type { Scenes } from 'telegraf';

import { db } from '../../db/client';
import { logger } from '../../core/observability';
import { router } from '../../core/router';

import { formatKickstarterCard, formatKickstarterShort } from './format';
import { adminEditKeyboard, DEFAULT_SCROLL_ID, userViewKeyboard } from './menus';
import { getKickstarterById, hasUserPurchased, listKickstarters } from './repo';
import { ksCallback } from './schemas';
import { purchaseWithScroll } from './service';

const EDIT_SCENE_ID: Record<string, string> = {
  name: 'ks:edit:name',
  creator: 'ks:edit:creator',
  cost: 'ks:edit:cost',
  link: 'ks:edit:link',
  pledge_name: 'ks:edit:pledge_name',
  pledge_cost: 'ks:edit:pledge_cost',
};

export function registerKickstarterActions(): void {
  router.on(ksCallback, async (ctx, payload) => {
    if (!ctx.from) {
      await ctx.answerCbQuery?.();
      return;
    }
    const roles = ctx.state.roles ?? [];
    const isAdmin = roles.includes('admin') || roles.includes('super');

    switch (payload.a) {
      case 'ksList': {
        const rows = await listKickstarters(db);
        const body = rows.length === 0 ? 'Пока пусто.' : rows.map(formatKickstarterShort).join('\n');
        await ctx.editMessageText(body);
        await ctx.answerCbQuery?.();
        break;
      }
      case 'ksView': {
        const ks = await getKickstarterById(db, payload.id);
        if (!ks) {
          await ctx.answerCbQuery?.('Не найден');
          return;
        }
        const owned = await hasUserPurchased(db, ctx.from.id, payload.id);
        await ctx.reply(formatKickstarterCard(ks), {
          parse_mode: 'HTML',
          ...userViewKeyboard(ks, owned),
        });
        await ctx.answerCbQuery?.();
        break;
      }
      case 'ksBuyScroll': {
        const result = await purchaseWithScroll({
          userId: ctx.from.id,
          kickstarterId: payload.id,
          scrollId: DEFAULT_SCROLL_ID,
        });
        if (result.status === 'not_found') {
          await ctx.answerCbQuery?.('Не найден');
          return;
        }
        if (result.status === 'insufficient_scrolls') {
          await ctx.answerCbQuery?.(
            `Не хватает свитков (${result.available}/${result.required})`,
            { show_alert: true },
          );
          return;
        }
        if (result.status === 'already_owned' || result.status === 'purchased') {
          // Deliver files (don't await — fire and forget over Telegram)
          for (const fileId of result.fileIds) {
            try {
              await ctx.replyWithDocument(fileId);
            } catch (err) {
              logger.warn({ err, fileId }, 'kickstarter file delivery failed');
            }
          }
          await ctx.answerCbQuery?.(result.status === 'purchased' ? 'Куплено' : 'Уже куплено');
        }
        break;
      }
      case 'ksAdminMenu': {
        if (!isAdmin) {
          await ctx.answerCbQuery?.('Нет прав');
          return;
        }
        const ks = await getKickstarterById(db, payload.id);
        if (!ks) {
          await ctx.answerCbQuery?.('Не найден');
          return;
        }
        await ctx.reply(formatKickstarterCard(ks), {
          parse_mode: 'HTML',
          ...adminEditKeyboard(ks),
        });
        await ctx.answerCbQuery?.();
        break;
      }
      case 'ksEdit': {
        if (!isAdmin) {
          await ctx.answerCbQuery?.('Нет прав');
          return;
        }
        const sceneId = EDIT_SCENE_ID[payload.f];
        if (!sceneId) {
          await ctx.answerCbQuery?.('Поле не поддерживается');
          return;
        }
        await ctx.answerCbQuery?.();
        await (ctx as unknown as Scenes.SceneContext).scene.enter(sceneId, { kickstarterId: payload.id });
        break;
      }
    }
  });
}
```

### Step 2: `routes.ts` — user commands

```typescript
import type { Telegraf } from 'telegraf';

import { db } from '../../db/client';

import { formatKickstarterShort } from './format';
import { listKickstarters, listUserKickstarters } from './repo';

export function registerKickstarterCommands(bot: Telegraf): void {
  bot.command('kickstarters', async (ctx) => {
    const rows = await listKickstarters(db);
    if (rows.length === 0) {
      await ctx.reply('Каталог пуст.');
      return;
    }
    await ctx.reply(rows.map(formatKickstarterShort).join('\n'));
  });

  bot.command('mykickstarters', async (ctx) => {
    if (!ctx.from) return;
    const rows = await listUserKickstarters(db, ctx.from.id);
    if (rows.length === 0) {
      await ctx.reply('Пока ничего не купил.');
      return;
    }
    await ctx.reply(rows.map(formatKickstarterShort).join('\n'));
  });
}
```

### Step 3: `admin-routes.ts` — admin commands

```typescript
import type { Scenes, Telegraf } from 'telegraf';

import { requireRoles } from '../../core/permissions';

import { KS_ADD_CHAIN } from './scenes/add-chain';

export function registerKickstarterAdminCommands(bot: Telegraf): void {
  bot.command('ks_add', requireRoles('admin', 'super'), async (ctx) => {
    await (ctx as unknown as Scenes.SceneContext).scene.enter(KS_ADD_CHAIN.steps[0]!, {});
  });
}
```

### Step 4: Commit

```bash
npm run typecheck
npm run lint
git add src/features/kickstarters/actions.ts src/features/kickstarters/routes.ts src/features/kickstarters/admin-routes.ts
git commit -m "feat(features/kickstarters): action handlers + user/admin commands"
```

---

## Task 8: `src/features/kickstarters/index.ts` and wire into `src/index.ts`

**Files:**
- Create: `src/features/kickstarters/index.ts`
- Modify: `src/index.ts`

### Step 1: `index.ts`

```typescript
import { Scenes, type Telegraf } from 'telegraf';

import { registerKickstarterActions } from './actions';
import { registerKickstarterAdminCommands } from './admin-routes';
import { registerKickstarterCommands } from './routes';
import { ALL_EDIT_SCENES } from './scenes/edit-scenes';
import { costScene } from './scenes/add/cost';
import { creatorScene } from './scenes/add/creator';
import { filesScene } from './scenes/add/files';
import { linkScene } from './scenes/add/link';
import { nameScene } from './scenes/add/name';
import { photosScene } from './scenes/add/photos';
import { pledgeCostScene } from './scenes/add/pledge-cost';
import { pledgeNameScene } from './scenes/add/pledge-name';
import { reviewScene } from './scenes/add/review';

export function getKickstarterScenes(): Scenes.BaseScene<Scenes.SceneContext>[] {
  return [
    ...ALL_EDIT_SCENES,
    nameScene,
    creatorScene,
    linkScene,
    costScene,
    pledgeNameScene,
    pledgeCostScene,
    photosScene,
    filesScene,
    reviewScene,
  ];
}

export function register(bot: Telegraf): void {
  registerKickstarterCommands(bot);
  registerKickstarterAdminCommands(bot);
  registerKickstarterActions();
}

export { sendKickstarterPromo } from './promo';
```

### Step 2: Modify `src/index.ts`

Add import:

```typescript
import { getKickstarterScenes, register as registerKickstarters } from './features/kickstarters';
```

Adjust the Stage construction. The previous version created the stage with only raid scenes; now it composes both raid and kickstarter scenes. Replace:

```typescript
const raidStage = createRaidStage();
bot.use(raidStage.middleware());
```

with:

```typescript
const stage = new Scenes.Stage<Scenes.SceneContext>([
  ...createRaidStage().scenes.values(),
  ...getKickstarterScenes(),
]);
bot.use(stage.middleware());
```

NOTE: `createRaidStage().scenes` is a `Map<string, BaseScene>`. If the API surface differs, build the combined list from individual scene exports instead — i.e., refactor `features/raids/index.ts` to export `getRaidScenes()` and adjust here. Implementer: choose the cleanest variant that typechecks.

Then call `registerKickstarters(bot);` after the existing feature register calls.

### Step 3: Verify pipeline

```bash
npm run gen:locale-types
npm run lint
npm run typecheck
npx vitest run "src/**/*.test.ts"
npm run build
ls dist/
```

All green; `dist/index.js` at the top level.

### Step 4: Commit

```bash
git add src/features/kickstarters/index.ts src/index.ts src/features/raids/index.ts # if you refactored raids index
git commit -m "feat(core): register kickstarters feature; combine scene stages"
```

---

## Task 9: Integration test

**Files:**
- Create: `tests/integration/kickstarters.repo.test.ts`

```typescript
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Knex } from 'knex';

import {
  createKickstarter,
  getKickstarterById,
  getKickstarterFiles,
  getKickstarterPhotos,
  hasUserPurchased,
  listKickstarters,
  listUserKickstarters,
  recordPurchase,
  updateKickstarterField,
} from '../../src/features/kickstarters/repo';
import { setupTestDb } from './setup';

describe('kickstarters.repo', () => {
  let db: Knex;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    ({ db, cleanup } = await setupTestDb());
    await db.migrate.latest();
    await db('users').insert([
      { id: 1, username: 'alice' },
      { id: 2, username: 'bob' },
    ]);
  });

  afterEach(async () => {
    await cleanup();
  });

  it('createKickstarter round-trips with photos and files', async () => {
    const id = await createKickstarter(db, {
      name: 'Mech',
      creator: 'Acme',
      cost: 1500,
      pledgeName: 'Standard',
      pledgeCost: 800,
      link: 'https://example.com',
      photoFileIds: ['ph1', 'ph2'],
      fileFileIds: ['f1'],
    });
    const ks = await getKickstarterById(db, id);
    expect(ks?.name).toBe('Mech');
    const photos = await getKickstarterPhotos(db, id);
    expect(photos.map((p) => p.fileId)).toEqual(['ph1', 'ph2']);
    const files = await getKickstarterFiles(db, id);
    expect(files.map((f) => f.fileId)).toEqual(['f1']);
  });

  it('hasUserPurchased + recordPurchase', async () => {
    const id = await createKickstarter(db, {
      name: 'X', creator: null, cost: 100, pledgeName: null, pledgeCost: null,
      link: null, photoFileIds: [], fileFileIds: [],
    });
    expect(await hasUserPurchased(db, 1, id)).toBe(false);
    expect(await recordPurchase(db, 1, id)).toBe(true);
    expect(await hasUserPurchased(db, 1, id)).toBe(true);
    expect(await recordPurchase(db, 1, id)).toBe(false); // idempotent
  });

  it('updateKickstarterField updates whitelisted fields', async () => {
    const id = await createKickstarter(db, {
      name: 'Old', creator: null, cost: 100, pledgeName: null, pledgeCost: null,
      link: null, photoFileIds: [], fileFileIds: [],
    });
    await updateKickstarterField(db, id, 'name', 'New Name');
    expect((await getKickstarterById(db, id))!.name).toBe('New Name');
    await updateKickstarterField(db, id, 'cost', 2000);
    expect((await getKickstarterById(db, id))!.cost).toBe(2000);
  });

  it('updateKickstarterField rejects non-whitelisted columns', async () => {
    const id = await createKickstarter(db, {
      name: 'X', creator: null, cost: 100, pledgeName: null, pledgeCost: null,
      link: null, photoFileIds: [], fileFileIds: [],
    });
    await expect(updateKickstarterField(db, id, 'created_at' as never, 'whatever')).rejects.toThrow();
  });

  it('listUserKickstarters joins correctly', async () => {
    const id = await createKickstarter(db, {
      name: 'Y', creator: null, cost: 100, pledgeName: null, pledgeCost: null,
      link: null, photoFileIds: [], fileFileIds: [],
    });
    await recordPurchase(db, 1, id);
    const list = await listUserKickstarters(db, 1);
    expect(list.map((k) => k.id)).toContain(id);
    expect(await listUserKickstarters(db, 2)).toHaveLength(0);
  });

  it('listKickstarters orders by created_at desc', async () => {
    const id1 = await createKickstarter(db, {
      name: 'A', creator: null, cost: 100, pledgeName: null, pledgeCost: null,
      link: null, photoFileIds: [], fileFileIds: [],
    });
    const id2 = await createKickstarter(db, {
      name: 'B', creator: null, cost: 100, pledgeName: null, pledgeCost: null,
      link: null, photoFileIds: [], fileFileIds: [],
    });
    const rows = await listKickstarters(db);
    expect(rows[0]!.id).toBe(id2);
    expect(rows[1]!.id).toBe(id1);
  });
});
```

Commit:

```bash
git add tests/integration/kickstarters.repo.test.ts
git commit -m "test(integration): kickstarters repo"
```

---

## Self-review checklist

- [ ] One `sendKickstarterPromo` only (in `promo.ts`); no duplicate elsewhere.
- [ ] `makeEditFieldScene` is the only thing instantiating the 4 (now 6) edit scenes.
- [ ] `updateKickstarterField` whitelists the columns; non-whitelisted updates throw.
- [ ] `createKickstarter` uses `.returning('id')` — no maxId+name+creator lookup hack from the legacy code.
- [ ] `purchaseWithScroll` is fully transactional, idempotent via `user_kickstarters` insert + `xp_transactions` UNIQUE constraint.
- [ ] All unit tests pass (~170+ now).
- [ ] `npm run typecheck`, `npm run lint`, `npm run build` clean.
- [ ] Integration test compiles; fails ECONNREFUSED.

---

## What's next

Plan 08 — Subscriptions + Payments + Onboarding. The biggest plan: the single `successful_payment` handler, the idempotent `processSubscriptionPayment` transaction, SBP screenshot flow, one entry point for "buy current month", the linear onboarding scene replacing the legacy looping funnel, and admin approval flow.
