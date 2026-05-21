import { db } from '../../db/client';
import { getRolesForUser } from '../../db/repos/user-roles';
import { addRole, removeRole } from '../../db/repos/user-roles-mutations';
import { isKnownAchievement, type AchievementKey } from '../../shared/achievements';
import { parsePeriod } from '../../shared/period';
import { grantAchievement, userHasAchievement } from '../achievements';
import { giveScroll } from '../scrolls';

import { setUserBalance } from './repo';

const KNOWN_ROLES = [
  'newbie',
  'pending',
  'preapproved',
  'rejected',
  'regular',
  'plus',
  'admin',
  'adminPlus',
  'super',
  'polls',
  'adminPolls',
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

export async function adminGrantScroll(
  userId: number,
  scrollId: string,
  amount: number,
): Promise<number> {
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
