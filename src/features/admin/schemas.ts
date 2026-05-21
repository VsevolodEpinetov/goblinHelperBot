import { z } from 'zod';

export const adminCallback = z.discriminatedUnion('a', [
  z.object({ a: z.literal('adUser'), id: z.number().int() }),
  z.object({ a: z.literal('adGrantRole'), id: z.number().int() }),
  z.object({ a: z.literal('adRemoveRole'), id: z.number().int() }),
  z.object({ a: z.literal('adGrantScroll'), id: z.number().int() }),
  z.object({
    a: z.literal('adGrantAch'),
    id: z.number().int(),
    key: z.enum(['sbp_payment', 'years_of_service']),
  }),
  z.object({ a: z.literal('adChangeBalance'), id: z.number().int() }),
  z.object({ a: z.literal('adMonths') }),
  z.object({ a: z.literal('adAddMonth') }),
  z.object({
    a: z.literal('adSetMonthChat'),
    period: z.string(),
    tier: z.enum(['regular', 'plus']),
  }),
]);

export type AdminCallback = z.infer<typeof adminCallback>;
