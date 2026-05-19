import { z } from 'zod';

export const loyaltyCallback = z.discriminatedUnion('a', [
  z.object({ a: z.literal('profile') }),
  z.object({ a: z.literal('leaders') }),
]);
