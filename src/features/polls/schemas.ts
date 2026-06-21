import { z } from 'zod';

export const pollsCallback = z.discriminatedUnion('a', [
  z.object({ a: z.literal('polMenu') }),
  z.object({ a: z.literal('polCoreList') }),
  z.object({ a: z.literal('polDynList') }),
  z.object({ a: z.literal('polCoreReset') }),
  z.object({ a: z.literal('polDynReset') }),
  z.object({ a: z.literal('polCoreResetYes') }),
  z.object({ a: z.literal('polDynResetYes') }),
  z.object({ a: z.literal('polLaunch') }),
  z.object({ a: z.literal('polLaunchYes') }),
]);
