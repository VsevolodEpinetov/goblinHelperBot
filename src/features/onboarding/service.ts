import { bot } from '../../core/bot';
import { logger } from '../../core/observability';
import { db, type DbConn } from '../../db/client';
import { addRole, removeRole, replaceRole } from '../../db/repos/user-roles-mutations';
import { escapeHtml, truncate } from '../../shared/format';
import { archiveKeyboard } from '../subscriptions';

import { verdictKeyboard } from './menus';
import {
  getApplicationByUserId,
  insertApplication,
  setApplicationStatus,
  updateApplicationTale,
  type ApplicationRow,
  type ApplicationStatus,
} from './repo';

export function canSubmit(existing: ApplicationRow | undefined): boolean {
  if (!existing) return true;
  return existing.status === 'rejected';
}

/**
 * Normalize an applicant's free-text "tale": trim surrounding whitespace and
 * collapse blank input to null. Callers treat null as "no tale written yet".
 */
export function normalizeTale(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export interface SubmitInput {
  userId: number;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  tale: string;
}

export type SubmitResult =
  | { status: 'submitted'; applicationId: number }
  | { status: 'already_pending'; applicationId: number }
  | { status: 'already_approved'; applicationId: number };

const ADMIN_NOTIFICATIONS_CHAT = process.env.ADMIN_NOTIFICATIONS_CHAT ?? '';

/** Submit an application + add the `pending` role atomically, then announce it to the совет. */
export async function submit(input: SubmitInput): Promise<SubmitResult> {
  const result = await db.transaction(async (trx) => submitInTrx(trx, input));
  if (result.status === 'submitted') {
    // Fire-and-forget after commit: the row must exist before the совет taps a verdict.
    void notifyAdminsNewApplication({
      id: result.applicationId,
      userId: input.userId,
      username: input.username,
      tale: input.tale,
    }).catch((err) =>
      logger.error(
        { err, applicationId: result.applicationId },
        'notify admins (new application) failed',
      ),
    );
  }
  return result;
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
    // rejected → allow re-apply: flip status back to pending, refresh the tale
    await setApplicationStatus(trx, existing.id, 'pending');
    await updateApplicationTale(trx, existing.id, input.tale);
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
    void notifyApproval(outcome.userId).catch((err) =>
      logger.debug({ err }, 'notifyApproval failed'),
    );
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
    void notifyRejection(outcome.userId).catch((err) =>
      logger.debug({ err }, 'notifyRejection failed'),
    );
    logger.info({ applicationId, reviewerId, userId: outcome.userId }, 'application rejected');
  }
  return outcome.result;
}

async function notifyApproval(userId: number): Promise<void> {
  await bot.telegram.sendMessage(
    userId,
    '🔥 Совет щёлкнул печатью — тебя впустили в логово. Теперь дело за казной: жми кнопку да забирай месячный архив.',
    archiveKeyboard(),
  );
}

async function notifyRejection(userId: number): Promise<void> {
  await bot.telegram.sendMessage(
    userId,
    '💀 Совет вынес вердикт: не в этот раз. Имя твоё не высекли на камне. Так решили старейшины.',
  );
}

/** Announce a freshly-submitted свиток to the совет's chat, with verdict buttons. */
async function notifyAdminsNewApplication(app: {
  id: number;
  userId: number;
  username: string | null;
  tale: string;
}): Promise<void> {
  if (!ADMIN_NOTIFICATIONS_CHAT) {
    logger.warn(
      { applicationId: app.id },
      'ADMIN_NOTIFICATIONS_CHAT not set; new application not announced to the совет',
    );
    return;
  }
  const who = escapeHtml(app.username ? `@${app.username}` : `id:${app.userId}`);
  const tale = escapeHtml(truncate(app.tale, 3500));
  const text = [
    `🔔 <b>Новый свиток #${app.id}</b>`,
    '',
    `Чужак ${who} просится в логово.`,
    '',
    'Его слова:',
    tale,
    '',
    'Совет, выноси вердикт.',
  ].join('\n');
  await bot.telegram.sendMessage(ADMIN_NOTIFICATIONS_CHAT, text, {
    parse_mode: 'HTML',
    ...verdictKeyboard(app.id),
  });
}

export type { ApplicationRow, ApplicationStatus };
