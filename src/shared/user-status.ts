export type StatusCode =
  | 'newbie'
  | 'pending'
  | 'preapproved'
  | 'rejected'
  | 'selfBanned'
  | 'banned'
  | 'admin'
  | 'super'
  | 'alumni'
  | 'friend';

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
  { role: 'friend', display: { code: 'friend', emoji: '🤝', text: 'Друг логова' } },
  { role: 'preapproved', display: { code: 'preapproved', emoji: '✅', text: 'Одобрен' } },
  // `goblin` — the legacy base "approved member" role (old JS bot). Treated
  // exactly like `preapproved`: full member, routed to the member hub.
  { role: 'goblin', display: { code: 'preapproved', emoji: '✅', text: 'Одобрен' } },
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
  return (
    set.has('preapproved') ||
    set.has('goblin') ||
    set.has('friend') ||
    set.has('admin') ||
    set.has('adminPlus') ||
    set.has('super')
  );
}

export function isStaff(roles: readonly string[]): boolean {
  const set = new Set(roles);
  return set.has('admin') || set.has('adminPlus') || set.has('super');
}

/**
 * A «friend of the lair»: comped full access (every archive + the main group)
 * without paying, but NOT staff — they see only the regular member menu and
 * hold no admin powers, and they are never auto-promoted in chats.
 */
export function isFriend(roles: readonly string[]): boolean {
  return roles.includes('friend');
}

/**
 * Users who reach every archive without a payment record on file: friends
 * (comped) and staff (by office). The join handler and the «keys» menu treat
 * these as having access to all bound archives.
 */
export function hasAllArchiveAccess(roles: readonly string[]): boolean {
  return isFriend(roles) || isStaff(roles);
}

const APPROVED_ROLES = new Set([
  'preapproved',
  'goblin', // legacy base member role — see PRIORITY note above.
  'alumni',
  'friend',
  'regular',
  'plus',
  'admin',
  'adminPlus',
  'super',
]);

/**
 * True if the user is past the gate — an approved member (paid, approved,
 * alumnus, friend, or staff), as opposed to a newbie/pending/rejected/banned
 * outsider. Use this to authorize member-only callbacks: a hidden menu is not a
 * security boundary, so every member callback must check this itself.
 */
export function isApprovedMember(roles: readonly string[]): boolean {
  return roles.some((r) => APPROVED_ROLES.has(r));
}
