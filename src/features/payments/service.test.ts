import { describe, expect, it } from 'vitest';

import { encodePayload, decodePayload, computeOldMonthMultiplier } from './service';

describe('payments.service.encodePayload / decodePayload', () => {
  it('round-trips a subscription payload', () => {
    const payload = { t: 'sub' as const, userId: 1, period: '2026_05', tier: 'regular' as const };
    const encoded = encodePayload(payload);
    expect(encoded.length).toBeLessThanOrEqual(128);
    expect(decodePayload(encoded)).toEqual(payload);
  });

  it('round-trips a kickstarter payload', () => {
    const payload = { t: 'ks' as const, userId: 1, kickstarterId: 42 };
    expect(decodePayload(encodePayload(payload))).toEqual(payload);
  });

  it('returns null for invalid JSON', () => {
    expect(decodePayload('not-json')).toBeNull();
  });

  it('returns null for payloads that do not match the schema', () => {
    expect(decodePayload(JSON.stringify({ t: 'unknown' }))).toBeNull();
  });
});

describe('payments.service.computeOldMonthMultiplier', () => {
  it('returns 3x for old months', () => {
    expect(computeOldMonthMultiplier()).toBe(3);
  });
});
