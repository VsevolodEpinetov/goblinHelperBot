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

export interface PendingSbpItem extends PaymentTrackingRow {
  username: string | null;
}

/** Pending SBP requests, oldest first — the admin review queue. */
export async function listPendingSbp(conn: DbConn, limit = 10): Promise<PendingSbpItem[]> {
  const rows = await conn('payment_tracking')
    .leftJoin('users', 'users.id', 'payment_tracking.user_id')
    .where('payment_tracking.status', 'pending')
    .where('payment_tracking.source', 'sbp')
    .orderBy('payment_tracking.created_at', 'asc')
    .limit(limit)
    .select('payment_tracking.*', 'users.username as username');
  return rows.map((r: Record<string, unknown>) => ({
    ...(rowToTracking(r) as PaymentTrackingRow),
    username: (r.username as string | null) ?? null,
  }));
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
