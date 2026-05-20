import { logger, metrics } from '../../core/observability';
import { db, type DbConn } from '../../db/client';
import {
  recordPurchase as recordKickstarterPurchase,
  hasUserPurchased as hasUserPurchasedKickstarter,
} from '../kickstarters/repo';
import { dispatchNotifications, grantXpInTrx } from '../loyalty';

import { findByChargeId, insertPending, markCompleted, type PaymentSource } from './repo';
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
