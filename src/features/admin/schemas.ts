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
  z.object({ a: z.literal('adFriend'), id: z.number().int(), on: z.boolean() }),
  // Per-user month (archive access) management on the user card.
  z.object({ a: z.literal('adUMon'), id: z.number().int() }),
  z.object({ a: z.literal('adGMon'), id: z.number().int(), t: z.enum(['regular', 'plus', 'both']) }),
  z.object({
    a: z.literal('adRMon'),
    id: z.number().int(),
    period: z.string(),
    tier: z.enum(['regular', 'plus']),
  }),
  // In-chat archive binding (/this_is): tapped inside the target group/channel.
  z.object({
    a: z.literal('bindHere'),
    period: z.string(),
    tier: z.enum(['regular', 'plus']),
  }),
  z.object({ a: z.literal('bindCancel') }),
  z.object({ a: z.literal('adMonths'), page: z.number().int().min(0).optional() }),
  z.object({ a: z.literal('adAddMonth') }),
  z.object({ a: z.literal('adFind') }),
  z.object({ a: z.literal('adKsAdd') }),
  z.object({ a: z.literal('adHealth') }),
  z.object({
    a: z.literal('adSetMonthChat'),
    period: z.string(),
    tier: z.enum(['regular', 'plus']),
  }),
]);

export type AdminCallback = z.infer<typeof adminCallback>;
