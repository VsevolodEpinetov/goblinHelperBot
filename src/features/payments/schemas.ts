import { z } from 'zod';

/**
 * Typed payment payload. Both `pre_checkout_query` and `successful_payment`
 * parse the invoice payload through this schema. Adding a new payment type
 * is a 1-line addition here + a new branch in `payments.service`.
 */
export const PaymentPayload = z.discriminatedUnion('t', [
  z.object({
    t: z.literal('sub'),
    userId: z.number(),
    period: z.string(), // 'YYYY_MM'
    tier: z.enum(['regular', 'plus']),
  }),
  z.object({
    t: z.literal('old'),
    userId: z.number(),
    period: z.string(),
    tier: z.enum(['regular', 'plus']),
  }),
  z.object({
    t: z.literal('upgrade'),
    userId: z.number(),
    period: z.string(),
  }),
  z.object({
    t: z.literal('ks'),
    userId: z.number(),
    kickstarterId: z.number().int(),
  }),
]);

export type PaymentPayloadT = z.infer<typeof PaymentPayload>;

/** Maximum bytes for a Telegram invoice payload. */
export const MAX_PAYLOAD_BYTES = 128;
