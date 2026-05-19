import { z } from 'zod';

export const commonCallback = z.discriminatedUnion('a', [z.object({ a: z.literal('del') })]);
