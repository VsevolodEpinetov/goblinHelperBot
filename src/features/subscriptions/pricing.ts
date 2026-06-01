import { computePrice } from '../../shared/pricing';

/** Base (pre-discount) Stars price for a tier, from env (defaults 350 / 1000). */
export function basePrice(tier: 'regular' | 'plus'): number {
  const reg = Number(process.env.REGULAR_PRICE ?? 350);
  const plus = Number(process.env.PLUS_PRICE ?? 1000);
  return tier === 'plus' ? plus : reg;
}

/** Base (pre-discount) delta for upgrading regular → plus. */
export function upgradeBaseDelta(): number {
  return basePrice('plus') - basePrice('regular');
}

/** Whether this user is the configured TEST_USER_ID (charged 1 star). */
export function isTestUser(userId: number): boolean {
  const v = process.env.TEST_USER_ID;
  return v ? Number(v) === userId : false;
}

/**
 * The price a member is actually charged for `base`, with the same discount
 * rules `sendStarsInvoice` applies (years_of_service 50%, test-user override).
 * Use this so the buy screen shows exactly what Telegram will invoice.
 */
export function finalPrice(
  base: number,
  opts: { yearsOfService: boolean; isTestUser: boolean },
): number {
  return computePrice({
    basePrice: base,
    yearsOfService: opts.yearsOfService,
    isTestUser: opts.isTestUser,
  }).final;
}
