export interface PriceInput {
  /** Base price in the target currency unit (XTR Stars or RUB). */
  basePrice: number;
  /** True when the user has the years_of_service achievement. */
  yearsOfService: boolean;
  /** True when the user is flagged as a test/dev user (1-unit override). */
  isTestUser: boolean;
}

export interface PriceResult {
  /** Final price the user is charged. */
  final: number;
  /** Discount applied (0–100), reported even when overridden. */
  discountPercent: number;
  /** Provenance of the final price for logging/observability. */
  source: {
    yearsOfService: boolean;
    testOverride: boolean;
  };
}

const YEARS_OF_SERVICE_MULTIPLIER = 0.5;
const TEST_USER_PRICE = 1;

export function computePrice(input: PriceInput): PriceResult {
  if (input.basePrice < 0) {
    throw new Error('basePrice must be non-negative');
  }

  const discountPercent = input.yearsOfService ? 50 : 0;
  const afterDiscount = input.yearsOfService
    ? Math.round(input.basePrice * YEARS_OF_SERVICE_MULTIPLIER)
    : input.basePrice;

  const final = input.isTestUser ? TEST_USER_PRICE : afterDiscount;

  return {
    final,
    discountPercent,
    source: {
      yearsOfService: input.yearsOfService,
      testOverride: input.isTestUser,
    },
  };
}
