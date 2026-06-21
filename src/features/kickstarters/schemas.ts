import { z } from 'zod';

export const ksCallback = z.discriminatedUnion('a', [
  z.object({
    a: z.literal('ksList'),
    p: z.number().int().min(0).optional(),
    u: z.boolean().optional(),
  }),
  z.object({ a: z.literal('ksMine'), p: z.number().int().min(0).optional() }),
  z.object({ a: z.literal('ksSearch') }),
  z.object({ a: z.literal('ksView'), id: z.number().int(), p: z.number().int().min(0).optional() }),
  z.object({ a: z.literal('ksScrollAsk'), id: z.number().int() }),
  z.object({ a: z.literal('ksBuyScroll'), id: z.number().int() }),
  z.object({ a: z.literal('ksRedownload'), id: z.number().int() }),
  z.object({
    a: z.literal('ksEdit'),
    id: z.number().int(),
    f: z.enum(['name', 'creator', 'cost', 'pledge_name', 'pledge_cost', 'link']),
  }),
  z.object({ a: z.literal('ksAdminMenu'), id: z.number().int() }),
  z.object({ a: z.literal('ksAdd') }),
]);

export type KsCallback = z.infer<typeof ksCallback>;
