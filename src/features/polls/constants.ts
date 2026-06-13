export const POLLS_ROLES = ['polls', 'adminPolls', 'admin', 'adminPlus', 'super'] as const;
export type PollsRole = (typeof POLLS_ROLES)[number];
