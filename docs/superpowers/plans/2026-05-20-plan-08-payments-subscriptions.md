# Plan 08 — Payments + Subscriptions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `src/features/payments/` and `src/features/subscriptions/`. Single `successful_payment` and `pre_checkout_query` handler. Idempotent + transactional `process*` functions for all four payment types (`sub`, `old`, `ks`, `upgrade`). One `startPurchaseFlow` entry point replacing the 5+ legacy `pay*` actions. Achievement-gated SBP screenshot path with admin confirm.

**Architecture:** `payments/` owns money plumbing (invoice creation, payload validation, payment-tracking writes, post-payment side effects). `subscriptions/` owns the user-facing purchase UI (which payment path to enter, what the keyboards look like). The two split is critical: kickstarter Stars purchases (deferred from Plan 07) get their `purchaseWithStars` here in `payments/service.ts`, so kickstarters/ doesn't need to know about Telegram invoices.

**Tech Stack:** TypeScript, Telegraf v4 (Stars invoices via `ctx.replyWithInvoice`), knex, Vitest, zod.

**Spec reference:** §4.1 of `docs/superpowers/specs/2026-05-17-bot-greenfield-rewrite-design.md`.

**Prerequisites:** Plans 01–07 complete. After migration 018+019:
- `payment_tracking(id, user_id, type, subscription_type, period, amount, currency, status, invoice_message_id, telegram_payment_charge_id UNIQUE, is_upgrade, source, created_at, completed_at)`
- `user_groups(user_id, period, type)` — `period` is e.g. `'2024_01'`
- `months(id, period, type, chat_id, counter_joined, counter_paid, created_at)`

**Out of scope:**
- Onboarding / applications (Plan 09).
- Admin tooling beyond manual payment confirmation (Plan 10).
- Real-time refund handling — only `paymentTracking.status = 'failed'` marker, no automated refunds.

---

## File Structure

**Created (`src/features/payments/`):**
- `schemas.ts`
- `repo.ts`
- `service.ts` + `service.test.ts`
- `invoice.ts`
- `handlers.ts`
- `sbp-scene.ts`
- `admin-actions.ts`
- `index.ts`

**Created (`src/features/subscriptions/`):**
- `repo.ts`
- `service.ts` + `service.test.ts`
- `schemas.ts`
- `menus.ts`
- `routes.ts`
- `actions.ts`
- `index.ts`

**Created (integration tests):**
- `tests/integration/payments.repo.test.ts`
- `tests/integration/subscriptions.repo.test.ts`

**Modified:**
- `src/index.ts` — register both features, add SBP scene to Stage
- `src/features/kickstarters/actions.ts` — add `ksBuyStars` callback that calls into `payments.purchaseKickstarterWithStars` (no Stars-buy button shown yet because we don't have it in the menus; we'll add it in this plan via subscriptions/menus.ts wiring)

---

## Task 1: `src/features/payments/schemas.ts`

**Files:**
- Create: `src/features/payments/schemas.ts`

### Step 1: Implement

```typescript
import { z } from 'zod';

/**
 * Typed payment payload. Both `pre_checkout_query` and `successful_payment`
 * parse the invoice payload through this schema. Adding a new payment type
 * is a 1-line addition here + a new branch in `payments.service`.
 */
export const PaymentPayload = z.discriminatedUnion('t', [
  z.object({
    t: z.literal('sub'),
    userId: z.number(),
    period: z.string(), // 'YYYY_MM'
    tier: z.enum(['regular', 'plus']),
  }),
  z.object({
    t: z.literal('old'),
    userId: z.number(),
    period: z.string(),
    tier: z.enum(['regular', 'plus']),
  }),
  z.object({
    t: z.literal('upgrade'),
    userId: z.number(),
    period: z.string(),
  }),
  z.object({
    t: z.literal('ks'),
    userId: z.number(),
    kickstarterId: z.number().int(),
  }),
]);

export type PaymentPayloadT = z.infer<typeof PaymentPayload>;

/** Maximum bytes for a Telegram invoice payload. */
export const MAX_PAYLOAD_BYTES = 128;
```

### Step 2: Commit

```bash
mkdir -p src/features/payments
# write schemas.ts
npm run typecheck
git add src/features/payments/schemas.ts
git commit -m "feat(features/payments): typed payment payload (discriminated union)"
```

---

## Task 2: `src/features/payments/repo.ts`

**Files:**
- Create: `src/features/payments/repo.ts`

### Step 1: Implement

```typescript
import type { DbConn } from '../../db/client';

import type { PaymentPayloadT } from './schemas';

export type PaymentSource = 'stars' | 'sbp' | 'manual';
export type PaymentStatus = 'pending' | 'completed' | 'failed';

export interface PaymentTrackingRow {
  id: number;
  userId: number;
  type: string;
  subscriptionType: string | null;
  period: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  invoiceMessageId: number | null;
  telegramPaymentChargeId: string | null;
  isUpgrade: boolean;
  source: PaymentSource;
  createdAt: Date;
  completedAt: Date | null;
}

function rowToTracking(row: Record<string, unknown> | undefined): PaymentTrackingRow | undefined {
  if (!row) return undefined;
  return {
    id: row.id as number,
    userId: row.user_id as number,
    type: row.type as string,
    subscriptionType: (row.subscription_type as string | null) ?? null,
    period: (row.period as string | null) ?? null,
    amount: Number(row.amount),
    currency: row.currency as string,
    status: row.status as PaymentStatus,
    invoiceMessageId: (row.invoice_message_id as number | null) ?? null,
    telegramPaymentChargeId: (row.telegram_payment_charge_id as string | null) ?? null,
    isUpgrade: !!row.is_upgrade,
    source: (row.source as PaymentSource) ?? 'stars',
    createdAt: row.created_at as Date,
    completedAt: (row.completed_at as Date | null) ?? null,
  };
}

export async function findByChargeId(
  conn: DbConn,
  chargeId: string,
): Promise<PaymentTrackingRow | undefined> {
  const row = await conn('payment_tracking').where('telegram_payment_charge_id', chargeId).first();
  return rowToTracking(row);
}

export interface InsertPendingInput {
  userId: number;
  type: PaymentPayloadT['t'];
  subscriptionType: string | null;
  period: string | null;
  amount: number;
  currency: string;
  invoiceMessageId: number | null;
  isUpgrade: boolean;
  source: PaymentSource;
}

export async function insertPending(conn: DbConn, input: InsertPendingInput): Promise<number> {
  const [row] = await conn('payment_tracking')
    .insert({
      user_id: input.userId,
      type: input.type,
      subscription_type: input.subscriptionType,
      period: input.period,
      amount: input.amount,
      currency: input.currency,
      status: 'pending',
      invoice_message_id: input.invoiceMessageId,
      is_upgrade: input.isUpgrade,
      source: input.source,
    })
    .returning('id');
  return row.id;
}

export async function markCompleted(
  conn: DbConn,
  paymentId: number,
  chargeId: string,
): Promise<void> {
  await conn('payment_tracking').where('id', paymentId).update({
    status: 'completed',
    telegram_payment_charge_id: chargeId,
    completed_at: conn.fn.now(),
  });
}

export async function markFailed(conn: DbConn, paymentId: number): Promise<void> {
  await conn('payment_tracking').where('id', paymentId).update({ status: 'failed' });
}

/** Used by admin to look up payments for a user. */
export async function listForUser(
  conn: DbConn,
  userId: number,
  limit = 20,
): Promise<PaymentTrackingRow[]> {
  const rows = await conn('payment_tracking')
    .where('user_id', userId)
    .orderBy('created_at', 'desc')
    .limit(limit);
  return rows.map(rowToTracking) as PaymentTrackingRow[];
}
```

### Step 2: Commit

```bash
npm run typecheck
git add src/features/payments/repo.ts
git commit -m "feat(features/payments): payment_tracking repository"
```

---

## Task 3: `src/features/payments/service.ts` (the critical idempotency layer, TDD)

**Files:**
- Create: `src/features/payments/service.ts`
- Create: `src/features/payments/service.test.ts`

### Step 1: Test (pure helpers only — full DB transaction is integration-tested)

```typescript
import { describe, expect, it } from 'vitest';

import { encodePayload, decodePayload, computeOldMonthMultiplier } from './service';

describe('payments.service.encodePayload / decodePayload', () => {
  it('round-trips a subscription payload', () => {
    const payload = { t: 'sub' as const, userId: 1, period: '2026_05', tier: 'regular' as const };
    const encoded = encodePayload(payload);
    expect(encoded.length).toBeLessThanOrEqual(128);
    expect(decodePayload(encoded)).toEqual(payload);
  });

  it('round-trips a kickstarter payload', () => {
    const payload = { t: 'ks' as const, userId: 1, kickstarterId: 42 };
    expect(decodePayload(encodePayload(payload))).toEqual(payload);
  });

  it('returns null for invalid JSON', () => {
    expect(decodePayload('not-json')).toBeNull();
  });

  it('returns null for payloads that do not match the schema', () => {
    expect(decodePayload(JSON.stringify({ t: 'unknown' }))).toBeNull();
  });
});

describe('payments.service.computeOldMonthMultiplier', () => {
  it('returns 3x for old months', () => {
    expect(computeOldMonthMultiplier()).toBe(3);
  });
});
```

### Step 2: Implement

```typescript
import { db, type DbConn } from '../../db/client';
import { logger, metrics } from '../../core/observability';
import { recordPurchase as recordKickstarterPurchase, hasUserPurchased as hasUserPurchasedKickstarter } from '../kickstarters/repo';
import { dispatchNotifications, grantXpInTrx } from '../loyalty';

import {
  findByChargeId,
  insertPending,
  markCompleted,
  type PaymentSource,
} from './repo';
import { PaymentPayload, type PaymentPayloadT, MAX_PAYLOAD_BYTES } from './schemas';

export const OLD_MONTH_MULTIPLIER = 3;

export function computeOldMonthMultiplier(): number {
  return OLD_MONTH_MULTIPLIER;
}

/** Serialise a typed payload to a JSON string. Throws if exceeds Telegram's limit. */
export function encodePayload(payload: PaymentPayloadT): string {
  const json = JSON.stringify(payload);
  if (json.length > MAX_PAYLOAD_BYTES) {
    throw new Error(`Payment payload exceeds ${MAX_PAYLOAD_BYTES} bytes (got ${json.length})`);
  }
  return json;
}

/** Decode + validate a payload string. Returns null on any failure. */
export function decodePayload(input: string): PaymentPayloadT | null {
  try {
    const parsed = JSON.parse(input) as unknown;
    const result = PaymentPayload.safeParse(parsed);
    if (!result.success) return null;
    return result.data;
  } catch {
    return null;
  }
}

export interface ProcessResult {
  status: 'processed' | 'already_processed' | 'unknown_payload';
  paymentId?: number;
}

/** Common pre-flight idempotency check used by all process* functions. */
async function idempotencyShortCircuit(
  conn: DbConn,
  chargeId: string,
): Promise<{ already: true; paymentId: number } | { already: false }> {
  const existing = await findByChargeId(conn, chargeId);
  if (existing?.status === 'completed') {
    return { already: true, paymentId: existing.id };
  }
  return { already: false };
}

/** Process a `successful_payment` for a subscription. Idempotent + transactional. */
export async function processSubscriptionPayment(
  payload: Extract<PaymentPayloadT, { t: 'sub' }> | Extract<PaymentPayloadT, { t: 'old' }>,
  source: PaymentSource,
  amount: number,
  currency: string,
  chargeId: string,
): Promise<ProcessResult> {
  return db.transaction(async (trx) => {
    const guard = await idempotencyShortCircuit(trx, chargeId);
    if (guard.already) {
      metrics.incr('payments.duplicate_blocked');
      return { status: 'already_processed', paymentId: guard.paymentId };
    }

    const paymentId = await insertPending(trx, {
      userId: payload.userId,
      type: payload.t,
      subscriptionType: payload.tier,
      period: payload.period,
      amount,
      currency,
      invoiceMessageId: null,
      isUpgrade: false,
      source,
    });

    // Grant access — idempotent at the schema level via UNIQUE(user_id, period, type) if you have it,
    // otherwise via onConflict ignore.
    await trx('user_groups')
      .insert({ user_id: payload.userId, period: payload.period, type: payload.tier })
      .onConflict(['user_id', 'period', 'type'])
      .ignore();

    await markCompleted(trx, paymentId, chargeId);

    // Increment month counter
    await trx('months')
      .where({ period: payload.period, type: payload.tier })
      .increment('counter_paid', 1);

    // Grant XP (idempotent via external_id)
    const xpAmount = payload.t === 'old' ? 300 : payload.tier === 'plus' ? 1600 : 600;
    const xpResult = await grantXpInTrx(trx, {
      userId: payload.userId,
      amount: xpAmount,
      source: `payment_${payload.t}`,
      externalId: chargeId,
      description: `${payload.t === 'old' ? 'Старый месяц' : 'Подписка'} ${payload.tier} за ${payload.period}`,
    });

    // Fire notifications post-transaction (after .then resolves to the result).
    setImmediate(() => dispatchNotifications(payload.userId, xpResult, `payment_${payload.t}`));

    metrics.incr('payments.success');
    return { status: 'processed', paymentId };
  });
}

/** Process an upgrade (regular → plus) for an existing period. */
export async function processUpgradePayment(
  payload: Extract<PaymentPayloadT, { t: 'upgrade' }>,
  source: PaymentSource,
  amount: number,
  currency: string,
  chargeId: string,
): Promise<ProcessResult> {
  return db.transaction(async (trx) => {
    const guard = await idempotencyShortCircuit(trx, chargeId);
    if (guard.already) {
      metrics.incr('payments.duplicate_blocked');
      return { status: 'already_processed', paymentId: guard.paymentId };
    }

    const paymentId = await insertPending(trx, {
      userId: payload.userId,
      type: 'upgrade',
      subscriptionType: 'plus',
      period: payload.period,
      amount,
      currency,
      invoiceMessageId: null,
      isUpgrade: true,
      source,
    });

    // Upgrade in user_groups
    await trx('user_groups')
      .insert({ user_id: payload.userId, period: payload.period, type: 'plus' })
      .onConflict(['user_id', 'period', 'type'])
      .ignore();

    await markCompleted(trx, paymentId, chargeId);

    const xpResult = await grantXpInTrx(trx, {
      userId: payload.userId,
      amount: 1000, // delta XP for upgrade
      source: 'payment_upgrade',
      externalId: chargeId,
      description: `Апгрейд до Plus за ${payload.period}`,
    });

    setImmediate(() => dispatchNotifications(payload.userId, xpResult, 'payment_upgrade'));
    metrics.incr('payments.success');
    return { status: 'processed', paymentId };
  });
}

/** Process a kickstarter purchase paid in Stars. */
export async function processKickstarterPayment(
  payload: Extract<PaymentPayloadT, { t: 'ks' }>,
  amount: number,
  currency: string,
  chargeId: string,
): Promise<ProcessResult> {
  return db.transaction(async (trx) => {
    const guard = await idempotencyShortCircuit(trx, chargeId);
    if (guard.already) {
      metrics.incr('payments.duplicate_blocked');
      return { status: 'already_processed', paymentId: guard.paymentId };
    }

    if (await hasUserPurchasedKickstarter(trx, payload.userId, payload.kickstarterId)) {
      logger.warn({ payload }, 'kickstarter Stars payment: user already owns');
      // Still record the payment tracking row so we have an audit trail, but
      // mark it completed without re-issuing the purchase row.
      const paymentId = await insertPending(trx, {
        userId: payload.userId,
        type: 'ks',
        subscriptionType: null,
        period: null,
        amount,
        currency,
        invoiceMessageId: null,
        isUpgrade: false,
        source: 'stars',
      });
      await markCompleted(trx, paymentId, chargeId);
      return { status: 'already_processed', paymentId };
    }

    const paymentId = await insertPending(trx, {
      userId: payload.userId,
      type: 'ks',
      subscriptionType: null,
      period: null,
      amount,
      currency,
      invoiceMessageId: null,
      isUpgrade: false,
      source: 'stars',
    });
    await recordKickstarterPurchase(trx, payload.userId, payload.kickstarterId);
    await markCompleted(trx, paymentId, chargeId);

    const xpResult = await grantXpInTrx(trx, {
      userId: payload.userId,
      amount: 300,
      source: 'payment_ks',
      externalId: chargeId,
      description: `Kickstarter #${payload.kickstarterId}`,
    });

    setImmediate(() => dispatchNotifications(payload.userId, xpResult, 'payment_ks'));
    metrics.incr('payments.success');
    return { status: 'processed', paymentId };
  });
}

/** Universal dispatch — call from the bot.on('successful_payment') handler. */
export async function processSuccessfulPayment(
  payloadJson: string,
  amount: number,
  currency: string,
  chargeId: string,
): Promise<ProcessResult> {
  const payload = decodePayload(payloadJson);
  if (!payload) {
    metrics.incr('payments.unknown_payload');
    return { status: 'unknown_payload' };
  }
  switch (payload.t) {
    case 'sub':
    case 'old':
      return processSubscriptionPayment(payload, 'stars', amount, currency, chargeId);
    case 'upgrade':
      return processUpgradePayment(payload, 'stars', amount, currency, chargeId);
    case 'ks':
      return processKickstarterPayment(payload, amount, currency, chargeId);
  }
}
```

### Step 3: Run + commit

```bash
npx vitest run src/features/payments/service.test.ts
npm run typecheck
git add src/features/payments/service.ts src/features/payments/service.test.ts
git commit -m "feat(features/payments): idempotent transactional payment processing"
```

---

## Task 4: `src/features/payments/invoice.ts`

**Files:**
- Create: `src/features/payments/invoice.ts`

### Step 1: Implement

```typescript
import type { Context } from 'telegraf';

import { computePrice } from '../../shared/pricing';
import { hasAchievement } from '../achievements/repo';
import { db } from '../../db/client';

import { encodePayload } from './service';
import type { PaymentPayloadT } from './schemas';

export interface InvoiceTexts {
  title: string;
  description: string;
  buttonLabel?: string; // shown in the price line
}

/** Send a Telegram Stars invoice for a given typed payload. */
export async function sendStarsInvoice(
  ctx: Context,
  payload: PaymentPayloadT,
  basePriceStars: number,
  texts: InvoiceTexts,
  isTestUser: boolean,
): Promise<void> {
  const yearsOfService = await hasAchievement(db, payload.userId, 'years_of_service');
  const price = computePrice({ basePrice: basePriceStars, yearsOfService, isTestUser });
  if (price.final <= 0) throw new Error('Computed price must be positive');

  const json = encodePayload(payload);
  const labelSuffix = price.discountPercent > 0 ? ` (-${price.discountPercent}%)` : '';

  // Telegraf v4 `ctx.replyWithInvoice` shape — extend Channel type if needed.
  await ctx.replyWithInvoice({
    title: texts.title,
    description: texts.description,
    payload: json,
    provider_token: '', // Telegram Stars
    currency: 'XTR',
    prices: [{ label: `${texts.buttonLabel ?? texts.title}${labelSuffix}`, amount: price.final }],
  });
}
```

NOTE: `ctx.replyWithInvoice` may have stricter Telegraf v4 typings; cast the args if necessary. The `provider_token: ''` empty string is required for Stars.

### Step 2: Commit

```bash
npm run typecheck
git add src/features/payments/invoice.ts
git commit -m "feat(features/payments): Stars invoice builder using shared pricing"
```

---

## Task 5: `src/features/payments/handlers.ts` (THE single source of payment dispatch)

**Files:**
- Create: `src/features/payments/handlers.ts`

### Step 1: Implement

```typescript
import type { Context, Telegraf } from 'telegraf';

import { logger, metrics } from '../../core/observability';

import { decodePayload, processSuccessfulPayment } from './service';

/**
 * Single source for both pre_checkout_query and successful_payment.
 * Replaces FOUR separate handlers in the legacy codebase.
 */
export function registerPaymentHandlers(bot: Telegraf): void {
  bot.on('pre_checkout_query', async (ctx) => {
    const q = ctx.preCheckoutQuery;
    if (!q) return;
    const payload = decodePayload(q.invoice_payload);
    if (!payload) {
      logger.warn({ payload: q.invoice_payload }, 'pre_checkout_query: invalid payload, rejecting');
      metrics.incr('payments.precheckout_rejected');
      await ctx.answerPreCheckoutQuery(false, 'Не удалось проверить платёж. Попробуй позже.');
      return;
    }
    metrics.incr('payments.precheckout_accepted');
    await ctx.answerPreCheckoutQuery(true);
  });

  bot.on('successful_payment', async (ctx) => {
    const sp = (ctx.message as { successful_payment?: { invoice_payload: string; total_amount: number; currency: string; telegram_payment_charge_id: string } }).successful_payment;
    if (!sp) return;
    const result = await processSuccessfulPayment(sp.invoice_payload, sp.total_amount, sp.currency, sp.telegram_payment_charge_id);
    switch (result.status) {
      case 'processed':
        await sendUserConfirmation(ctx, 'Платёж получен.');
        break;
      case 'already_processed':
        logger.info({ chargeId: sp.telegram_payment_charge_id }, 'duplicate successful_payment, ignored');
        break;
      case 'unknown_payload':
        logger.error({ payload: sp.invoice_payload }, 'successful_payment with unknown payload');
        break;
    }
  });
}

async function sendUserConfirmation(ctx: Context, text: string): Promise<void> {
  try {
    await ctx.reply(text);
  } catch (err) {
    logger.debug({ err }, 'sendUserConfirmation: failed');
  }
}
```

### Step 2: Commit

```bash
npm run typecheck
git add src/features/payments/handlers.ts
git commit -m "feat(features/payments): single source pre_checkout + successful_payment handler"
```

---

## Task 6: `src/features/payments/sbp-scene.ts` (SBP screenshot flow)

**Files:**
- Create: `src/features/payments/sbp-scene.ts`

### Step 1: Implement

```typescript
import { Markup, Scenes } from 'telegraf';

import { bot } from '../../core/bot';
import { logger } from '../../core/observability';
import { db } from '../../db/client';

import { insertPending } from './repo';

export interface SbpDraft {
  period?: string;
  tier?: 'regular' | 'plus';
  amount?: number; // RUB amount the user claims to have sent
  adminChatId?: string; // forwarded to this chat for admin review
}

export const SBP_SCENE_ID = 'payment:sbp';

export const sbpScene = new Scenes.BaseScene<Scenes.SceneContext>(SBP_SCENE_ID);

sbpScene.enter(async (ctx) => {
  const draft = ctx.scene.state as SbpDraft;
  if (!draft.period || !draft.tier) {
    await ctx.reply('Не указан период или тариф. Зайди заново через меню покупки.');
    await ctx.scene.leave();
    return;
  }
  await ctx.reply(
    `Пришли скриншот платежа за ${draft.tier === 'plus' ? 'Plus' : 'обычную'} подписку (${draft.period}). Админ подтвердит вручную.`,
  );
});

sbpScene.command('cancel', async (ctx) => {
  ctx.scene.state = {};
  await ctx.scene.leave();
  await ctx.reply('Отменено.');
});

sbpScene.on('photo', async (ctx) => {
  if (!ctx.from) return;
  const draft = ctx.scene.state as SbpDraft;
  if (!draft.period || !draft.tier || !draft.adminChatId) {
    await ctx.reply('Внутренняя ошибка: не хватает данных. Попробуй заново.');
    await ctx.scene.leave();
    return;
  }
  const photo = ctx.message.photo[ctx.message.photo.length - 1];
  if (!photo) {
    await ctx.reply('Не вижу фото.');
    return;
  }

  const paymentId = await insertPending(db, {
    userId: ctx.from.id,
    type: 'sub',
    subscriptionType: draft.tier,
    period: draft.period,
    amount: draft.amount ?? 0,
    currency: 'RUB',
    invoiceMessageId: null,
    isUpgrade: false,
    source: 'sbp',
  });

  try {
    await bot.telegram.sendPhoto(draft.adminChatId, photo.file_id, {
      caption: `SBP заявка #${paymentId}\nПользователь: ${ctx.from.id} (@${ctx.from.username ?? '—'})\nПериод: ${draft.period}\nТариф: ${draft.tier}`,
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback('✅ Подтвердить', `sbp:confirm:${paymentId}`),
          Markup.button.callback('❌ Отклонить', `sbp:reject:${paymentId}`),
        ],
      ]),
    });
    await ctx.reply('Заявка отправлена. Жди подтверждения админа.');
  } catch (err) {
    logger.error({ err, paymentId }, 'sbp: failed to forward to admin chat');
    await ctx.reply('Не удалось отправить заявку админу. Попробуй позже.');
  } finally {
    ctx.scene.state = {};
    await ctx.scene.leave();
  }
});

sbpScene.on('text', async (ctx) => {
  await ctx.reply('Пришли скриншот или /cancel.');
});
```

### Step 2: Commit

```bash
npm run typecheck
git add src/features/payments/sbp-scene.ts
git commit -m "feat(features/payments): SBP screenshot scene + admin notification"
```

---

## Task 7: `src/features/payments/admin-actions.ts`

**Files:**
- Create: `src/features/payments/admin-actions.ts`

Plain `bot.action(/^sbp:confirm:(\d+)$/, ...)` handlers — these aren't typed-router callbacks because they're admin-side text-encoded buttons inside `sbp-scene.ts`.

### Step 1: Implement

```typescript
import type { Telegraf } from 'telegraf';

import { requireRoles } from '../../core/permissions';
import { logger } from '../../core/observability';
import { db } from '../../db/client';
import { dispatchNotifications, grantXpInTrx } from '../loyalty';

import { markCompleted, markFailed } from './repo';

export function registerPaymentAdminActions(bot: Telegraf): void {
  bot.action(/^sbp:confirm:(\d+)$/, requireRoles('admin', 'super'), async (ctx) => {
    const paymentId = Number(ctx.match[1]);
    try {
      const result = await db.transaction(async (trx) => {
        const payment = await trx('payment_tracking').where('id', paymentId).first();
        if (!payment) return { ok: false, reason: 'not_found' as const };
        if (payment.status === 'completed') return { ok: false, reason: 'already_completed' as const };

        // Use the admin-confirmation timestamp as charge id (SBP has no real Telegram charge).
        const chargeId = `sbp:${paymentId}:${Date.now()}`;
        await trx('user_groups')
          .insert({ user_id: payment.user_id, period: payment.period, type: payment.subscription_type })
          .onConflict(['user_id', 'period', 'type'])
          .ignore();
        await markCompleted(trx, paymentId, chargeId);
        await trx('months')
          .where({ period: payment.period, type: payment.subscription_type })
          .increment('counter_paid', 1);

        const xpAmount = payment.subscription_type === 'plus' ? 1600 : 600;
        const xp = await grantXpInTrx(trx, {
          userId: payment.user_id,
          amount: xpAmount,
          source: 'payment_sub_sbp',
          externalId: chargeId,
          description: `SBP подписка ${payment.subscription_type} за ${payment.period}`,
        });
        return { ok: true as const, userId: payment.user_id as number, xp };
      });

      if (result.ok) {
        dispatchNotifications(result.userId, result.xp, 'payment_sub_sbp');
        await ctx.answerCbQuery('Подтверждено');
        await ctx.editMessageCaption(`SBP #${paymentId} — ✅ подтверждён`);
      } else {
        await ctx.answerCbQuery(result.reason === 'already_completed' ? 'Уже подтверждён' : 'Не найден');
      }
    } catch (err) {
      logger.error({ err, paymentId }, 'sbp confirm failed');
      await ctx.answerCbQuery('Ошибка');
    }
  });

  bot.action(/^sbp:reject:(\d+)$/, requireRoles('admin', 'super'), async (ctx) => {
    const paymentId = Number(ctx.match[1]);
    try {
      await markFailed(db, paymentId);
      await ctx.answerCbQuery('Отклонён');
      await ctx.editMessageCaption(`SBP #${paymentId} — ❌ отклонён`);
    } catch (err) {
      logger.error({ err, paymentId }, 'sbp reject failed');
      await ctx.answerCbQuery('Ошибка');
    }
  });
}
```

### Step 2: Commit

```bash
npm run typecheck
git add src/features/payments/admin-actions.ts
git commit -m "feat(features/payments): admin SBP confirm/reject actions"
```

---

## Task 8: `src/features/payments/index.ts` + integration test

**Files:**
- Create: `src/features/payments/index.ts`
- Create: `tests/integration/payments.repo.test.ts`

### Step 1: `index.ts`

```typescript
import type { Telegraf } from 'telegraf';

import { registerPaymentAdminActions } from './admin-actions';
import { registerPaymentHandlers } from './handlers';

export { sendStarsInvoice } from './invoice';
export { encodePayload, decodePayload } from './service';
export type { PaymentPayloadT } from './schemas';
export { sbpScene, SBP_SCENE_ID, type SbpDraft } from './sbp-scene';
export {
  processSubscriptionPayment,
  processUpgradePayment,
  processKickstarterPayment,
  processSuccessfulPayment,
} from './service';

export function register(bot: Telegraf): void {
  registerPaymentHandlers(bot);
  registerPaymentAdminActions(bot);
}
```

### Step 2: `tests/integration/payments.repo.test.ts`

```typescript
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Knex } from 'knex';

import {
  findByChargeId,
  insertPending,
  listForUser,
  markCompleted,
  markFailed,
} from '../../src/features/payments/repo';
import { setupTestDb } from './setup';

describe('payments.repo', () => {
  let db: Knex;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    ({ db, cleanup } = await setupTestDb());
    await db.migrate.latest();
    await db('users').insert({ id: 1, username: 'u1' });
  });

  afterEach(async () => {
    await cleanup();
  });

  it('insertPending + markCompleted + findByChargeId round-trips', async () => {
    const id = await insertPending(db, {
      userId: 1,
      type: 'sub',
      subscriptionType: 'plus',
      period: '2026_05',
      amount: 500,
      currency: 'XTR',
      invoiceMessageId: null,
      isUpgrade: false,
      source: 'stars',
    });
    await markCompleted(db, id, 'charge_xyz');
    const row = await findByChargeId(db, 'charge_xyz');
    expect(row).toBeDefined();
    expect(row!.status).toBe('completed');
    expect(row!.subscriptionType).toBe('plus');
  });

  it('telegram_payment_charge_id UNIQUE constraint fires', async () => {
    const id1 = await insertPending(db, {
      userId: 1, type: 'sub', subscriptionType: 'regular', period: '2026_05',
      amount: 100, currency: 'XTR', invoiceMessageId: null, isUpgrade: false, source: 'stars',
    });
    await markCompleted(db, id1, 'dupe');

    const id2 = await insertPending(db, {
      userId: 1, type: 'sub', subscriptionType: 'regular', period: '2026_06',
      amount: 100, currency: 'XTR', invoiceMessageId: null, isUpgrade: false, source: 'stars',
    });
    await expect(markCompleted(db, id2, 'dupe')).rejects.toThrow(/unique|duplicate/i);
  });

  it('listForUser returns descending by created_at', async () => {
    await insertPending(db, { userId: 1, type: 'sub', subscriptionType: 'regular', period: '2026_05', amount: 1, currency: 'XTR', invoiceMessageId: null, isUpgrade: false, source: 'stars' });
    await insertPending(db, { userId: 1, type: 'sub', subscriptionType: 'plus', period: '2026_06', amount: 2, currency: 'XTR', invoiceMessageId: null, isUpgrade: false, source: 'stars' });
    const rows = await listForUser(db, 1);
    expect(rows[0]!.period).toBe('2026_06');
  });

  it('markFailed updates status', async () => {
    const id = await insertPending(db, { userId: 1, type: 'sub', subscriptionType: 'regular', period: '2026_05', amount: 1, currency: 'XTR', invoiceMessageId: null, isUpgrade: false, source: 'sbp' });
    await markFailed(db, id);
    const rows = await listForUser(db, 1);
    expect(rows[0]!.status).toBe('failed');
  });
});
```

### Step 3: Commit

```bash
git add src/features/payments/index.ts tests/integration/payments.repo.test.ts
git commit -m "feat(features/payments): index + integration test"
```

---

## Task 9: `src/features/subscriptions/repo.ts`

**Files:**
- Create: `src/features/subscriptions/repo.ts`

### Step 1: Implement

```typescript
import type { DbConn } from '../../db/client';

export type SubscriptionTier = 'regular' | 'plus';

export interface UserSubscriptionStatus {
  period: string;
  hasRegular: boolean;
  hasPlus: boolean;
}

export async function getSubscriptionStatus(
  conn: DbConn,
  userId: number,
  period: string,
): Promise<UserSubscriptionStatus> {
  const rows = await conn('user_groups')
    .where({ user_id: userId, period })
    .select('type');
  const types = new Set<string>(rows.map((r: { type: string }) => r.type));
  return {
    period,
    hasRegular: types.has('regular'),
    hasPlus: types.has('plus'),
  };
}

export async function listUserSubscriptions(
  conn: DbConn,
  userId: number,
): Promise<Array<{ period: string; tier: SubscriptionTier }>> {
  const rows = await conn('user_groups')
    .where('user_id', userId)
    .orderBy('period', 'desc')
    .select('period', 'type');
  return rows.map((r: { period: string; type: SubscriptionTier }) => ({ period: r.period, tier: r.type }));
}

export async function getMonthChatId(
  conn: DbConn,
  period: string,
  tier: SubscriptionTier,
): Promise<string | null> {
  const row = await conn('months').where({ period, type: tier }).first('chat_id');
  return row?.chat_id ?? null;
}
```

### Step 2: Commit

```bash
mkdir -p src/features/subscriptions
git add src/features/subscriptions/repo.ts
git commit -m "feat(features/subscriptions): user_groups repository"
```

---

## Task 10: `src/features/subscriptions/service.ts` (the single state machine, TDD)

**Files:**
- Create: `src/features/subscriptions/service.ts`
- Create: `src/features/subscriptions/service.test.ts`

### Step 1: Test

```typescript
import { describe, expect, it } from 'vitest';

import { decidePurchaseAction } from './service';

describe('subscriptions.service.decidePurchaseAction', () => {
  const today = { year: 2026, month: 5 };

  it('returns "already_plus" when user has plus for the target period', () => {
    expect(
      decidePurchaseAction({
        target: { year: 2026, month: 5 },
        today,
        status: { period: '2026_05', hasRegular: false, hasPlus: true },
      }),
    ).toEqual({ action: 'already_plus' });
  });

  it('returns "offer_upgrade" when user has regular for current period', () => {
    expect(
      decidePurchaseAction({
        target: { year: 2026, month: 5 },
        today,
        status: { period: '2026_05', hasRegular: true, hasPlus: false },
      }),
    ).toEqual({ action: 'offer_upgrade' });
  });

  it('returns "buy_current" when no membership and target is current period', () => {
    expect(
      decidePurchaseAction({
        target: { year: 2026, month: 5 },
        today,
        status: { period: '2026_05', hasRegular: false, hasPlus: false },
      }),
    ).toEqual({ action: 'buy_current' });
  });

  it('returns "buy_old" when target is in the past and user has neither', () => {
    expect(
      decidePurchaseAction({
        target: { year: 2025, month: 12 },
        today,
        status: { period: '2025_12', hasRegular: false, hasPlus: false },
      }),
    ).toEqual({ action: 'buy_old' });
  });

  it('returns "already_regular_old" when target is past and user has regular', () => {
    expect(
      decidePurchaseAction({
        target: { year: 2025, month: 12 },
        today,
        status: { period: '2025_12', hasRegular: true, hasPlus: false },
      }),
    ).toEqual({ action: 'already_regular_old' });
  });
});
```

### Step 2: Implement

```typescript
import { formatPeriod, isHistoricalPeriod, type Period } from '../../shared/period';

import type { UserSubscriptionStatus } from './repo';

export type PurchaseAction =
  | { action: 'already_plus' }
  | { action: 'already_regular_old' }
  | { action: 'offer_upgrade' }
  | { action: 'buy_current' }
  | { action: 'buy_old' };

export interface DecideInput {
  target: Period;
  today: Period;
  status: UserSubscriptionStatus;
}

/** The single state machine that decides which purchase path a user enters. */
export function decidePurchaseAction(input: DecideInput): PurchaseAction {
  if (input.status.hasPlus) return { action: 'already_plus' };
  const isPast = isHistoricalPeriod(input.target, input.today);
  if (isPast) {
    if (input.status.hasRegular) return { action: 'already_regular_old' };
    return { action: 'buy_old' };
  }
  // Current or future period
  if (input.status.hasRegular) return { action: 'offer_upgrade' };
  return { action: 'buy_current' };
}

export function periodKey(p: Period): string {
  return formatPeriod(p);
}
```

### Step 3: Run + commit

```bash
npx vitest run src/features/subscriptions/service.test.ts
git add src/features/subscriptions/service.ts src/features/subscriptions/service.test.ts
git commit -m "feat(features/subscriptions): purchase-state decision machine"
```

---

## Task 11: `src/features/subscriptions/schemas.ts` + `menus.ts`

**Files:**
- Create: `src/features/subscriptions/schemas.ts`
- Create: `src/features/subscriptions/menus.ts`

### Step 1: `schemas.ts`

```typescript
import { z } from 'zod';

export const subscriptionsCallback = z.discriminatedUnion('a', [
  z.object({ a: z.literal('subBuy'), year: z.number().int(), month: z.number().int(), tier: z.enum(['regular', 'plus']) }),
  z.object({ a: z.literal('subUpgrade'), year: z.number().int(), month: z.number().int() }),
  z.object({ a: z.literal('subSbp'), year: z.number().int(), month: z.number().int(), tier: z.enum(['regular', 'plus']) }),
  z.object({ a: z.literal('ksStars'), id: z.number().int() }),
]);

export type SubscriptionsCallback = z.infer<typeof subscriptionsCallback>;
```

### Step 2: `menus.ts`

```typescript
import { Markup } from 'telegraf';

import { router } from '../../core/router';
import type { Period } from '../../shared/period';

import { subscriptionsCallback } from './schemas';

export function buyKeyboard(period: Period, sbpAllowed: boolean): ReturnType<typeof Markup.inlineKeyboard> {
  const rows: ReturnType<typeof Markup.button.callback>[][] = [
    [
      Markup.button.callback(
        'Обычная (⭐)',
        router.encode(subscriptionsCallback, { a: 'subBuy', year: period.year, month: period.month, tier: 'regular' }),
      ),
      Markup.button.callback(
        'Плюс (⭐)',
        router.encode(subscriptionsCallback, { a: 'subBuy', year: period.year, month: period.month, tier: 'plus' }),
      ),
    ],
  ];
  if (sbpAllowed) {
    rows.push([
      Markup.button.callback(
        'Обычная (СБП)',
        router.encode(subscriptionsCallback, { a: 'subSbp', year: period.year, month: period.month, tier: 'regular' }),
      ),
      Markup.button.callback(
        'Плюс (СБП)',
        router.encode(subscriptionsCallback, { a: 'subSbp', year: period.year, month: period.month, tier: 'plus' }),
      ),
    ]);
  }
  return Markup.inlineKeyboard(rows);
}

export function upgradeKeyboard(period: Period): ReturnType<typeof Markup.inlineKeyboard> {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        'Апгрейд до Plus',
        router.encode(subscriptionsCallback, { a: 'subUpgrade', year: period.year, month: period.month }),
      ),
    ],
  ]);
}
```

### Step 3: Commit

```bash
npm run typecheck
git add src/features/subscriptions/schemas.ts src/features/subscriptions/menus.ts
git commit -m "feat(features/subscriptions): callbacks + buy/upgrade keyboards"
```

---

## Task 12: `src/features/subscriptions/routes.ts` + `actions.ts`

**Files:**
- Create: `src/features/subscriptions/routes.ts`
- Create: `src/features/subscriptions/actions.ts`

### Step 1: `routes.ts`

```typescript
import type { Telegraf } from 'telegraf';

import { db } from '../../db/client';
import { currentPeriod, formatPeriod } from '../../shared/period';
import { canPayViaSbp } from '../../shared/achievements';
import { getRolesForUser } from '../../db/repos/user-roles';
import { getUserAchievements } from '../achievements/service';

import { buyKeyboard, upgradeKeyboard } from './menus';
import { getSubscriptionStatus } from './repo';
import { decidePurchaseAction } from './service';

export function registerSubscriptionCommands(bot: Telegraf): void {
  bot.command('buy', async (ctx) => {
    if (!ctx.from) return;
    const today = currentPeriod();
    const period = formatPeriod(today);
    const status = await getSubscriptionStatus(db, ctx.from.id, period);
    const decision = decidePurchaseAction({ target: today, today, status });

    const achievements = (await getUserAchievements(ctx.from.id)).map((a) => a.type);
    const sbpAllowed = canPayViaSbp(achievements);

    switch (decision.action) {
      case 'already_plus':
        await ctx.reply(`У тебя уже есть Plus за ${period}.`);
        return;
      case 'offer_upgrade':
        await ctx.reply(`Регулярная подписка за ${period} уже куплена. Можешь обновиться до Plus.`, upgradeKeyboard(today));
        return;
      case 'buy_current':
        await ctx.reply(`Подписка за ${period}:`, buyKeyboard(today, sbpAllowed));
        return;
      case 'buy_old':
      case 'already_regular_old':
        await ctx.reply('Старые месяцы покупаются по запросу. Напиши админу.');
        return;
    }
  });
}
```

### Step 2: `actions.ts`

```typescript
import type { Scenes } from 'telegraf';

import { db } from '../../db/client';
import { logger } from '../../core/observability';
import { router } from '../../core/router';
import { formatPeriod } from '../../shared/period';
import { sendStarsInvoice } from '../payments';
import { SBP_SCENE_ID, type SbpDraft } from '../payments';
import { getConfig } from '../../core/config';

import { subscriptionsCallback } from './schemas';

// Base prices read from env / shared/loyalty-config? For simplicity, env-driven:
function getBasePrice(tier: 'regular' | 'plus'): number {
  const reg = Number(process.env.REGULAR_PRICE ?? 350);
  const plus = Number(process.env.PLUS_PRICE ?? 1000);
  return tier === 'plus' ? plus : reg;
}

function getTestUserId(): number | undefined {
  const v = process.env.TEST_USER_ID;
  return v ? Number(v) : undefined;
}

const ADMIN_NOTIFICATIONS_CHAT = process.env.ADMIN_NOTIFICATIONS_CHAT ?? '';

export function registerSubscriptionActions(): void {
  router.on(subscriptionsCallback, async (ctx, payload) => {
    if (!ctx.from) {
      await ctx.answerCbQuery?.();
      return;
    }
    const testUserId = getTestUserId();
    const isTestUser = testUserId !== undefined && ctx.from.id === testUserId;

    switch (payload.a) {
      case 'subBuy': {
        const period = formatPeriod({ year: payload.year, month: payload.month });
        try {
          await sendStarsInvoice(
            ctx,
            { t: 'sub', userId: ctx.from.id, period, tier: payload.tier },
            getBasePrice(payload.tier),
            { title: `Подписка ${payload.tier} ${period}`, description: `${period}` },
            isTestUser,
          );
          await ctx.answerCbQuery?.();
        } catch (err) {
          logger.error({ err }, 'subBuy: invoice send failed');
          await ctx.answerCbQuery?.('Не удалось создать счёт', { show_alert: true });
        }
        break;
      }
      case 'subUpgrade': {
        const period = formatPeriod({ year: payload.year, month: payload.month });
        try {
          const upgradeDelta = getBasePrice('plus') - getBasePrice('regular');
          await sendStarsInvoice(
            ctx,
            { t: 'upgrade', userId: ctx.from.id, period },
            upgradeDelta,
            { title: `Апгрейд до Plus ${period}`, description: `${period}` },
            isTestUser,
          );
          await ctx.answerCbQuery?.();
        } catch (err) {
          logger.error({ err }, 'subUpgrade: invoice send failed');
          await ctx.answerCbQuery?.('Ошибка', { show_alert: true });
        }
        break;
      }
      case 'subSbp': {
        const period = formatPeriod({ year: payload.year, month: payload.month });
        const draft: SbpDraft = {
          period,
          tier: payload.tier,
          amount: 0, // user can describe in caption later; for v2 we don't ask
          adminChatId: ADMIN_NOTIFICATIONS_CHAT,
        };
        if (!ADMIN_NOTIFICATIONS_CHAT) {
          await ctx.answerCbQuery?.('SBP не настроен', { show_alert: true });
          break;
        }
        await ctx.answerCbQuery?.();
        await (ctx as unknown as Scenes.SceneContext).scene.enter(SBP_SCENE_ID, draft as object);
        break;
      }
      case 'ksStars': {
        const { getKickstarterById } = await import('../kickstarters/repo');
        const ks = await getKickstarterById(db, payload.id);
        if (!ks) {
          await ctx.answerCbQuery?.('Не найден');
          break;
        }
        try {
          await sendStarsInvoice(
            ctx,
            { t: 'ks', userId: ctx.from.id, kickstarterId: payload.id },
            ks.cost,
            { title: ks.name, description: `Kickstarter #${ks.id}` },
            isTestUser,
          );
          await ctx.answerCbQuery?.();
        } catch (err) {
          logger.error({ err, ksId: payload.id }, 'ksStars: invoice failed');
          await ctx.answerCbQuery?.('Ошибка', { show_alert: true });
        }
        break;
      }
    }
  });
}

export { getConfig }; // re-export to satisfy linter for unused import if any
```

NOTE: remove the trailing `export { getConfig }` if linter doesn't complain. Likewise, replace `process.env.*` reads with `getConfig()` if more env vars are added to `core/config.ts` first.

### Step 3: Commit

```bash
npm run typecheck
npm run lint
git add src/features/subscriptions/routes.ts src/features/subscriptions/actions.ts
git commit -m "feat(features/subscriptions): single buy entry point + Stars/SBP actions"
```

---

## Task 13: `src/features/subscriptions/index.ts`

**Files:**
- Create: `src/features/subscriptions/index.ts`

```typescript
import type { Telegraf } from 'telegraf';

import { registerSubscriptionActions } from './actions';
import { registerSubscriptionCommands } from './routes';

export function register(bot: Telegraf): void {
  registerSubscriptionCommands(bot);
  registerSubscriptionActions();
}

export { decidePurchaseAction } from './service';
export { getSubscriptionStatus, listUserSubscriptions } from './repo';
```

Commit:

```bash
git add src/features/subscriptions/index.ts
git commit -m "feat(features/subscriptions): public surface"
```

---

## Task 14: Wire into `src/index.ts`

**Files:**
- Modify: `src/index.ts`

### Step 1: Add imports and register calls

```typescript
import * as paymentsFeature from './features/payments';
import * as subscriptionsFeature from './features/subscriptions';
// (other imports already exist)
```

Compose the SBP scene into the existing combined stage:

```typescript
const combinedStage = new Scenes.Stage<Scenes.SceneContext>([
  ...Array.from(createRaidStage().scenes.values()),
  ...getKickstarterScenes(),
  paymentsFeature.sbpScene,
]);
bot.use(combinedStage.middleware());
```

After the existing feature register calls:

```typescript
paymentsFeature.register(bot);
subscriptionsFeature.register(bot);
```

### Step 2: Verify pipeline

```bash
npm run gen:locale-types && npm run lint && npm run typecheck && npx vitest run "src/**/*.test.ts" && npm run build
```

All green; `dist/index.js` at top level.

### Step 3: Commit

```bash
git add src/index.ts
git commit -m "feat(core): register payments + subscriptions; SBP scene in stage"
```

---

## Self-review checklist

- [ ] `bot.on('successful_payment', ...)` registered EXACTLY ONCE (in `payments/handlers.ts`). Grep to verify.
- [ ] `bot.on('pre_checkout_query', ...)` registered EXACTLY ONCE.
- [ ] Every `process*` function in `payments/service.ts` starts with `findByChargeId` idempotency check.
- [ ] Every `process*` function wraps DB writes in `db.transaction`.
- [ ] `decidePurchaseAction` is the only place that decides which purchase path to show — no inline state checks in `actions.ts`.
- [ ] `computePrice` from `shared/pricing.ts` is the only thing computing discounted prices.
- [ ] All unit tests pass.
- [ ] Integration test compiles; fails ECONNREFUSED.
- [ ] Build green.

---

## What's next

Plan 09 — Onboarding (`features/onboarding/`). Linear application scene replacing the legacy looping funnel; admin approval flow splitting the 912-line `allApplications.js` into list-routes/single-user-routes/service. After Plan 09: the bot can do its primary job end-to-end (apply, get approved, buy month, join group) using the new code path.
