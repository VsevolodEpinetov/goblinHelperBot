import { db } from '../../db/client';
import { getRolesForUser } from '../../db/repos/user-roles';
import { addRole, removeRole } from '../../db/repos/user-roles-mutations';
import { isKnownAchievement, type AchievementKey } from '../../shared/achievements';
import { parsePeriod } from '../../shared/period';
import { grantAchievement, userHasAchievement } from '../achievements';
import { giveScroll } from '../scrolls';
import { isKnownScrollId, KNOWN_SCROLL_IDS } from '../scrolls/service';
import {
  grantMonth,
  listUserSubscriptions,
  revokeMonth,
  type SubscriptionTier,
} from '../subscriptions/repo';

import { setUserBalance } from './repo';

const KNOWN_ROLES = [
  'newbie',
  'pending',
  'preapproved',
  'goblin', // legacy base member role (old JS bot); equivalent to preapproved.
  'rejected',
  'regular',
  'plus',
  'friend',
  'admin',
  'adminPlus',
  'super',
  'polls',
  'adminPolls',
  'adminKs',
  'alumni',
  'selfBanned',
  'banned',
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

/**
 * Tolerant period parser for the `/this_is` command: accepts `2026_05`,
 * `2026-05`, `2026.05`, `2026/05`, `2026 5`, etc. Returns the canonical
 * `YYYY_MM` form, or null when it can't be read.
 */
export function normalizePeriodInput(raw: string): string | null {
  const m = /^(\d{4})[-_./\s]?(\d{1,2})$/.exec(raw.trim());
  if (!m) return null;
  const period = `${m[1]}_${m[2]!.padStart(2, '0')}`;
  try {
    parsePeriod(period); // validate the month is 1–12
    return period;
  } catch {
    return null;
  }
}

/** Parse an optional tier word/emoji; unknown or absent → undefined. */
export function parseTier(raw: string | undefined): 'regular' | 'plus' | undefined {
  if (!raw) return undefined;
  const t = raw.trim().toLowerCase();
  if (['plus', 'расширенный', 'расш', '💎'].includes(t)) return 'plus';
  if (['regular', 'обычный', 'обыч', '🪙'].includes(t)) return 'regular';
  return undefined;
}

/** The bare Russian word for a tier, for weaving into goblin sentences. */
export function tierWord(tier: 'regular' | 'plus'): string {
  return tier === 'plus' ? 'расширенный' : 'обычный';
}

/**
 * Bind a chat as the archive for (period, tier): one chat ↔ one archive. Clears
 * any stale binding that pointed at this same chat (so re-running /this_is in a
 * re-used chat moves it cleanly), then upserts the target month row's chat_id.
 * Returns the archive this chat previously served, if it was moved.
 */
export async function bindArchiveChat(
  period: string,
  tier: 'regular' | 'plus',
  chatId: string,
): Promise<{ movedFrom: { period: string; tier: string } | null }> {
  return db.transaction(async (trx) => {
    const others = (await trx('months')
      .where('chat_id', chatId)
      .select('period', 'type')) as Array<{ period: string; type: string }>;
    const moved = others.find((r) => !(r.period === period && r.type === tier)) ?? null;
    // One chat serves one archive — drop any other rows pointing here.
    await trx('months').where('chat_id', chatId).whereNot({ period, type: tier }).update({
      chat_id: null,
    });
    const updated = await trx('months').where({ period, type: tier }).update({ chat_id: chatId });
    if (updated === 0) {
      await trx('months')
        .insert({ period, type: tier, chat_id: chatId, counter_joined: 0, counter_paid: 0 })
        .onConflict(['period', 'type'])
        .merge({ chat_id: chatId });
    }
    return { movedFrom: moved ? { period: moved.period, tier: moved.type } : null };
  });
}

export function isKnownRole(role: string): role is KnownRole {
  return (KNOWN_ROLES as readonly string[]).includes(role);
}

const ROLE_RANK: Readonly<Record<string, number>> = {
  super: 3,
  adminPlus: 2,
  admin: 1,
};

export function roleRank(role: string): number {
  return ROLE_RANK[role] ?? 0;
}

export function highestRank(roles: readonly string[]): number {
  return roles.reduce((max, r) => Math.max(max, roleRank(r)), 0);
}

/**
 * Roles an admin assigns by hand from the user card, in display order. Excludes
 * lifecycle/auto states (newbie/pending/goblin/regular/plus/…) that flows set
 * themselves. The picker filters this by the actor's rank, so e.g. a plain
 * admin never sees admin/adminPlus (assertCanModerateRole would reject those).
 */
export const GRANTABLE_ROLES: ReadonlyArray<{ role: KnownRole; label: string }> = [
  { role: 'preapproved', label: '✅ preapproved' },
  { role: 'friend', label: '🤝 friend' },
  { role: 'polls', label: '📊 polls' },
  { role: 'adminPolls', label: '📊 adminPolls' },
  { role: 'adminKs', label: '🚀 adminKs' },
  { role: 'alumni', label: '🎓 alumni' },
  { role: 'admin', label: '🛠 admin' },
  { role: 'adminPlus', label: '🛠 adminPlus' },
  { role: 'banned', label: '🚫 banned' },
];

const ROLE_LABEL: Readonly<Record<string, string>> = Object.fromEntries(
  GRANTABLE_ROLES.map((e) => [e.role, e.label]),
);

/** A button label for a role: the catalog label, or the raw name as fallback. */
export function roleLabel(role: string): string {
  return ROLE_LABEL[role] ?? role;
}

export interface RoleParty {
  id: number;
  roles: readonly string[];
}

/**
 * Role moderation policy: an actor may only grant/remove roles strictly below
 * their own rank, only on users strictly below their own rank, and never on
 * themselves. Super outranks all, but nobody can grant/remove `super` here.
 */
export function assertCanModerateRole(actor: RoleParty, target: RoleParty, role: KnownRole): void {
  if (actor.id === target.id) throw new Error('⚖️ Свои роли не трогай — это указ совета.');
  const rank = highestRank(actor.roles);
  if (roleRank(role) >= rank) {
    throw new Error(`⚖️ Роль "${role}" не ниже твоей — такую не выдам, это указ совета.`);
  }
  if (highestRank(target.roles) >= rank) {
    throw new Error('⚖️ Этот гоблин рангом не ниже тебя — его не трону, указ совета.');
  }
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

export async function adminGrantRole(
  actor: RoleParty,
  userId: number,
  role: string,
): Promise<boolean> {
  if (!isKnownRole(role)) throw new Error(`Неизвестная роль: ${role}`);
  const targetRoles = await getRolesForUser(db, userId);
  assertCanModerateRole(actor, { id: userId, roles: targetRoles }, role);
  return addRole(db, userId, role);
}

export async function adminRemoveRole(
  actor: RoleParty,
  userId: number,
  role: string,
): Promise<boolean> {
  if (!isKnownRole(role)) throw new Error(`Неизвестная роль: ${role}`);
  const targetRoles = await getRolesForUser(db, userId);
  assertCanModerateRole(actor, { id: userId, roles: targetRoles }, role);
  return removeRole(db, userId, role);
}

export async function adminGrantScroll(
  userId: number,
  scrollId: string,
  amount: number,
): Promise<number> {
  if (!isKnownScrollId(scrollId)) {
    throw new Error(
      `📜 Такого свитка не знаю: ${scrollId}. В ходу: ${KNOWN_SCROLL_IDS.join(', ')}`,
    );
  }
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

/** The (period, tier) memberships a user currently holds, newest period first. */
export async function listUserMonths(
  userId: number,
): Promise<Array<{ period: string; tier: SubscriptionTier }>> {
  return listUserSubscriptions(db, userId);
}

/** Manually grant a month (archive access). True when newly granted. */
export async function adminGrantMonth(
  userId: number,
  period: string,
  tier: SubscriptionTier,
): Promise<boolean> {
  return grantMonth(db, userId, period, tier);
}

/** Manually revoke a month (archive access). True when a row was removed. */
export async function adminRevokeMonth(
  userId: number,
  period: string,
  tier: SubscriptionTier,
): Promise<boolean> {
  return revokeMonth(db, userId, period, tier);
}
