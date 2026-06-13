import { z } from 'zod';

export const onboardingCallback = z.discriminatedUnion('a', [
  z.object({ a: z.literal('onApplyStart') }), // user starts the application scene
  z.object({ a: z.literal('onAbout') }), // user wants info
  z.object({ a: z.literal('onCancel') }), // back from any screen
  z.object({ a: z.literal('onHome') }), // member returns to the hub from any screen
  z.object({ a: z.literal('onStatus') }), // pending applicant re-checks the verdict
]);

const appStatus = z.enum(['pending', 'approved', 'rejected']);

export const onboardingAdminCallback = z.discriminatedUnion('a', [
  z.object({ a: z.literal('onAdminHub') }), // admin opens the /admin hub from a button
  z.object({ a: z.literal('onAdminList'), page: z.number().int(), status: appStatus.optional() }),
  z.object({
    a: z.literal('onAdminFilter'),
    status: appStatus,
    page: z.number().int(),
  }),
  z.object({
    a: z.literal('onAdminView'),
    id: z.number().int(),
    page: z.number().int().optional(),
    status: appStatus.optional(),
  }),
  z.object({
    a: z.literal('onAdminApprove'),
    id: z.number().int(),
    page: z.number().int().optional(),
    status: appStatus.optional(),
  }),
  z.object({
    a: z.literal('onAdminReject'),
    id: z.number().int(),
    page: z.number().int().optional(),
    status: appStatus.optional(),
  }),
  z.object({ a: z.literal('onAdminBack'), page: z.number().int(), status: appStatus.optional() }),
]);
