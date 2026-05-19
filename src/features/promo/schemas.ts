import { z } from 'zod';

export const promoCallback = z.discriminatedUnion('a', [z.object({ a: z.literal('promoGet') })]);
