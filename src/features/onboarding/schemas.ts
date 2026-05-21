import { z } from 'zod';

export const onboardingCallback = z.discriminatedUnion('a', [
  z.object({ a: z.literal('onApplyStart') }), // user starts the application scene
  z.object({ a: z.literal('onAbout') }), // user wants info
  z.object({ a: z.literal('onCancel') }), // back from any screen
]);

export const onboardingAdminCallback = z.discriminatedUnion('a', [
  z.object({ a: z.literal('onAdminList'), page: z.number().int() }),
  z.object({
    a: z.literal('onAdminFilter'),
    status: z.enum(['pending', 'approved', 'rejected']),
    page: z.number().int(),
  }),
  z.object({ a: z.literal('onAdminView'), id: z.number().int() }),
  z.object({ a: z.literal('onAdminApprove'), id: z.number().int() }),
  z.object({ a: z.literal('onAdminReject'), id: z.number().int() }),
  z.object({ a: z.literal('onAdminBack'), page: z.number().int() }),
]);
