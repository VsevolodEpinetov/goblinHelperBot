import { z } from 'zod';

export const ksCallback = z.discriminatedUnion('a', [
  z.object({ a: z.literal('ksList') }),
  z.object({ a: z.literal('ksMine') }),
  z.object({ a: z.literal('ksView'), id: z.number().int() }),
  z.object({ a: z.literal('ksScrollAsk'), id: z.number().int() }),
  z.object({ a: z.literal('ksBuyScroll'), id: z.number().int() }),
  z.object({
    a: z.literal('ksEdit'),
    id: z.number().int(),
    f: z.enum(['name', 'creator', 'cost', 'pledge_name', 'pledge_cost', 'link']),
  }),
  z.object({ a: z.literal('ksAdminMenu'), id: z.number().int() }),
]);

export type KsCallback = z.infer<typeof ksCallback>;
