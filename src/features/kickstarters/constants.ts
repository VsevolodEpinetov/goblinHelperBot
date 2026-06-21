/**
 * `adminKs` is a trusted delegate who may create and edit kickstarters but is
 * NOT staff: no delete, no other admin powers, and (rank 0) grants no
 * moderation rights. Admin ranks can do everything a delegate can.
 *
 * Mirrors the polls delegate pattern (see ../polls/constants.ts): a delegate
 * reaches the create/edit flow from the member hub, since they never see the
 * «Админка» hub where the admin entry lives.
 */
export const KS_DELEGATE_ROLES = ['adminKs'] as const;

/** Everyone allowed to create & edit kickstarters: the delegate plus admins. */
export const KS_MANAGER_ROLES = ['adminKs', 'admin', 'adminPlus', 'super'] as const;

/** A non-admin kickstarter delegate — used to decide the member-hub button. */
export function isKsDelegate(roles: readonly string[]): boolean {
  return roles.some((r) => (KS_DELEGATE_ROLES as readonly string[]).includes(r));
}

/** Anyone who may create or edit kickstarters (delegate or admin rank). */
export function isKsManager(roles: readonly string[]): boolean {
  return roles.some((r) => (KS_MANAGER_ROLES as readonly string[]).includes(r));
}
