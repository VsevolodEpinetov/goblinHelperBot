import { featureConfig } from '../../core/config';
import { computePrice } from '../../shared/pricing';
import { computeOldMonthMultiplier } from '../payments/service';

/** Base (pre-discount) Stars price for a tier, from env (defaults 350 / 1000). */
export function basePrice(tier: 'regular' | 'plus'): number {
  const fc = featureConfig();
  return tier === 'plus' ? fc.plusPrice : fc.regularPrice;
}

/** Base (pre-discount) delta for upgrading regular → plus. */
export function upgradeBaseDelta(): number {
  return basePrice('plus') - basePrice('regular');
}

/** Base (pre-discount) price for a PAST month's archive — dearer (×multiplier). */
export function oldBasePrice(tier: 'regular' | 'plus'): number {
  return basePrice(tier) * computeOldMonthMultiplier();
}

/** RUB price for a tier paid via СБП, from env. Unset or invalid → undefined. */
export function sbpBasePriceRub(tier: 'regular' | 'plus'): number | undefined {
  const fc = featureConfig();
  return tier === 'plus' ? fc.sbpPricePlusRub : fc.sbpPriceRegularRub;
}

/** Free-text СБП requisites (получатель/телефон/банк) from env, or undefined. */
export function sbpRequisites(): string | undefined {
  return featureConfig().sbpRequisites;
}

/**
 * RUB amount for an СБП purchase, mirroring the Stars rules: a current-month
 * plus on top of an owned regular costs the upgrade delta, past months cost
 * ×multiplier (no delta, like the Stars old-archive flow). Undefined until the
 * SBP_PRICE_*_RUB env vars are configured.
 */
export function sbpAmountRub(opts: {
  tier: 'regular' | 'plus';
  kind: 'sub' | 'old';
  upgrade?: boolean;
}): number | undefined {
  if (opts.kind === 'sub' && opts.upgrade) {
    const regular = sbpBasePriceRub('regular');
    const plus = sbpBasePriceRub('plus');
    return regular !== undefined && plus !== undefined ? plus - regular : undefined;
  }
  const base = sbpBasePriceRub(opts.tier);
  if (base === undefined) return undefined;
  return opts.kind === 'old' ? base * computeOldMonthMultiplier() : base;
}

/** Whether this user is the configured TEST_USER_ID (charged 1 star). */
export function isTestUser(userId: number): boolean {
  const id = featureConfig().testUserId;
  return id !== undefined && id === userId;
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
