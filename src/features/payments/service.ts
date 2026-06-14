import { logger, metrics } from '../../core/observability';
import { db, type DbConn } from '../../db/client';
import {
  recordPurchase as recordKickstarterPurchase,
  hasUserPurchased as hasUserPurchasedKickstarter,
} from '../kickstarters/repo';
import { dispatchNotifications, grantXpInTrx } from '../loyalty';
import { getSubscriptionStatus } from '../subscriptions/repo';

import { findByChargeId, insertPending, markCompleted, type PaymentSource } from './repo';
import { PaymentPayload, type PaymentPayloadT, MAX_PAYLOAD_BYTES } from './schemas';

export const OLD_MONTH_MULTIPLIER = 3;

/** XP for a paid month archive — single tariff for the Stars and SBP paths. */
export function xpForSubscriptionPayment(type: string, tier: 'regular' | 'plus'): number {
  return type === 'old' ? 300 : tier === 'plus' ? 1600 : 600;
}

export function computeOldMonthMultiplier(): number {
  return OLD_MONTH_MULTIPLIER;
}

/**
 * The month group a user should receive a one-time invite link to after a
 * processed payment, or null when the payment grants no group access (e.g. a
 * kickstarter purchase).
 */
export function accessGroupForPayload(
  payload: PaymentPayloadT,
): { period: string; type: 'regular' | 'plus' } | null {
  switch (payload.t) {
    case 'sub':
    case 'old':
      return { period: payload.period, type: payload.tier };
    case 'upgrade':
      return { period: payload.period, type: 'plus' };
    case 'ks':
      return null;
  }
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
  /**
   * - `processed`: first-time successful payment; access/XP granted.
   * - `already_processed`: same chargeId already completed — harmless Telegram retry, no action.
   * - `refund_required`: fresh Stars consumed but content/access cannot be granted
   *   (user already owns the kickstarter, or upgrade payload sent without owning regular).
   *   Caller MUST issue `refundStarPayment(userId, chargeId)`.
   * - `unknown_payload`: schema-invalid payload; nothing inserted; logged.
   */
  status: 'processed' | 'already_processed' | 'refund_required' | 'unknown_payload';
  paymentId?: number;
  /** Set when status === 'refund_required'. Recipient of the refund. */
  refundUserId?: number;
  /** Human-readable reason, for logs and the DM to the refunded user. */
  refundReason?: string;
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

    // A stale invoice for an already-owned period (invoices stay payable
    // forever) must not silently keep the money — mirror the kickstarter
    // already-owned path and refund.
    const owned = await getSubscriptionStatus(trx, payload.userId, payload.period);
    if (owned.hasPlus || (payload.tier === 'regular' && owned.hasRegular)) {
      logger.warn({ payload, chargeId }, 'subscription payment: period already owned — refunding');
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
      await trx('payment_tracking').where('id', paymentId).update({ status: 'failed' });
      metrics.incr('payments.sub_already_owned');
      return {
        status: 'refund_required',
        paymentId,
        refundUserId: payload.userId,
        refundReason: 'этот архив у тебя уже есть, второй раз не продаем',
      };
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
    const xpAmount = xpForSubscriptionPayment(payload.t, payload.tier);
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

    // Upgrade payload must correspond to an existing regular subscription
    // for that period (otherwise the user pays the delta for what should cost
    // the full plus price) — and plus must NOT already be owned (a stale
    // upgrade invoice re-paid buys nothing). Both are refund cases.
    const status = await getSubscriptionStatus(trx, payload.userId, payload.period);
    if (status.hasPlus || !status.hasRegular) {
      const refundReason = status.hasPlus
        ? 'расширенный архив у тебя уже есть, второй раз не продаем'
        : 'нет обычной подписки для апгрейда';
      logger.warn({ payload, chargeId, refundReason }, 'upgrade payment invalid — refunding');
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
      // Mark failed so the row isn't mistaken for a successful upgrade.
      await trx('payment_tracking').where('id', paymentId).update({ status: 'failed' });
      metrics.incr('payments.upgrade_invalid_state');
      return {
        status: 'refund_required',
        paymentId,
        refundUserId: payload.userId,
        refundReason,
      };
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
      logger.warn(
        { payload, chargeId },
        'kickstarter Stars payment: user already owns — refunding',
      );
      // Record an audit trail row marked `failed` so we know this Stars charge
      // was refunded. The successful_payment handler will issue the refund.
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
      await trx('payment_tracking').where('id', paymentId).update({ status: 'failed' });
      metrics.incr('payments.kickstarter_already_owned');
      return {
        status: 'refund_required',
        paymentId,
        refundUserId: payload.userId,
        refundReason: 'кикстартер уже куплен',
      };
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
