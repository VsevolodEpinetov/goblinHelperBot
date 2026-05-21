import { describe, expect, it } from 'vitest';

import { canSubmit } from './service';

describe('onboarding.service.canSubmit', () => {
  it('true when no existing application', () => {
    expect(canSubmit(undefined)).toBe(true);
  });

  it('false when an application is already pending', () => {
    expect(canSubmit({ status: 'pending' } as never)).toBe(false);
  });

  it('false when already approved', () => {
    expect(canSubmit({ status: 'approved' } as never)).toBe(false);
  });

  it('true when previously rejected (allow re-apply)', () => {
    expect(canSubmit({ status: 'rejected' } as never)).toBe(true);
  });
});
