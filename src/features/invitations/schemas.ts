import { z } from 'zod';

export const invitationsCallback = z.discriminatedUnion('a', [
  z.object({
    a: z.literal('inviteGet'),
    year: z.number().int(),
    month: z.number().int(),
    tier: z.enum(['regular', 'plus']),
  }),
]);
