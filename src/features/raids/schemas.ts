import { z } from 'zod';

export const raidsCallback = z.discriminatedUnion('a', [
  z.object({ a: z.literal('raidList'), p: z.number().int().min(0).optional() }),
  z.object({ a: z.literal('raidCreate') }),
  z.object({ a: z.literal('raidMine'), p: z.number().int().min(0).optional() }),
  z.object({ a: z.literal('raidView'), id: z.number().int() }),
  z.object({ a: z.literal('raidJoin'), id: z.number().int() }),
  z.object({ a: z.literal('raidLeave'), id: z.number().int() }),
  z.object({ a: z.literal('raidClose'), id: z.number().int() }),
  z.object({ a: z.literal('raidComplete'), id: z.number().int() }),
  z.object({ a: z.literal('raidCancel'), id: z.number().int() }),
  z.object({ a: z.literal('raidCompleteAsk'), id: z.number().int() }),
  z.object({ a: z.literal('raidCancelAsk'), id: z.number().int() }),
]);

export type RaidsCallback = z.infer<typeof raidsCallback>;
