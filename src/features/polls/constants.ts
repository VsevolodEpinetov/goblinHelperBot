export const POLLS_ROLES = ['polls', 'adminPolls', 'admin', 'adminPlus', 'super'] as const;
export type PollsRole = (typeof POLLS_ROLES)[number];

/** The poll-running roles that are NOT admin rank. A holder reaches the polls
 * menu from the member hub (admins already have it via the «Админка» hub), so
 * the hub shows a «📊 Опросы» button only to these delegates. */
export const POLLS_DELEGATE_ROLES = ['polls', 'adminPolls'] as const;

export function isPollsDelegate(roles: readonly string[]): boolean {
  return roles.some((r) => (POLLS_DELEGATE_ROLES as readonly string[]).includes(r));
}
