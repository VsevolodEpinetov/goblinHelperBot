import type { Context } from 'telegraf';

import { db } from '../../db/client';
import { computePrice } from '../../shared/pricing';
import { hasAchievement } from '../achievements/repo';

import type { PaymentPayloadT } from './schemas';
import { encodePayload } from './service';

export interface InvoiceTexts {
  title: string;
  description: string;
  buttonLabel?: string; // shown in the price line
}

/** Send a Telegram Stars invoice for a given typed payload. */
export async function sendStarsInvoice(
  ctx: Context,
  payload: PaymentPayloadT,
  basePriceStars: number,
  texts: InvoiceTexts,
  isTestUser: boolean,
): Promise<void> {
  const yearsOfService = await hasAchievement(db, payload.userId, 'years_of_service');
  const price = computePrice({ basePrice: basePriceStars, yearsOfService, isTestUser });
  if (price.final <= 0) throw new Error('Computed price must be positive');

  const json = encodePayload(payload);
  const labelSuffix = price.discountPercent > 0 ? ` (-${price.discountPercent}%)` : '';

  // Telegraf v4 `ctx.replyWithInvoice` shape — the typegram type requires
  // `provider_token` (which is an empty string for Telegram Stars).
  const args = {
    title: texts.title,
    description: texts.description,
    payload: json,
    provider_token: '', // Telegram Stars
    currency: 'XTR',
    prices: [{ label: `${texts.buttonLabel ?? texts.title}${labelSuffix}`, amount: price.final }],
  } as Parameters<typeof ctx.replyWithInvoice>[0];

  await ctx.replyWithInvoice(args);
}
