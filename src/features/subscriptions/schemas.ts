import { z } from 'zod';

export const subscriptionsCallback = z.discriminatedUnion('a', [
  z.object({
    a: z.literal('subBuy'),
    year: z.number().int(),
    month: z.number().int(),
    tier: z.enum(['regular', 'plus']),
  }),
  z.object({ a: z.literal('subUpgrade'), year: z.number().int(), month: z.number().int() }),
  z.object({
    a: z.literal('subSbp'),
    year: z.number().int(),
    month: z.number().int(),
    tier: z.enum(['regular', 'plus']),
  }),
  z.object({ a: z.literal('ksStars'), id: z.number().int() }),
]);

export type SubscriptionsCallback = z.infer<typeof subscriptionsCallback>;
