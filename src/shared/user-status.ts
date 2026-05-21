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
