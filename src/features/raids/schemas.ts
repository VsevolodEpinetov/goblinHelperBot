import { z } from 'zod';

export const raidsCallback = z.discriminatedUnion('a', [
  z.object({ a: z.literal('raidView'), id: z.number().int() }),
  z.object({ a: z.literal('raidJoin'), id: z.number().int() }),
  z.object({ a: z.literal('raidLeave'), id: z.number().int() }),
  z.object({ a: z.literal('raidClose'), id: z.number().int() }),
  z.object({ a: z.literal('raidComplete'), id: z.number().int() }),
  z.object({ a: z.literal('raidCancel'), id: z.number().int() }),
]);

export type RaidsCallback = z.infer<typeof raidsCallback>;
