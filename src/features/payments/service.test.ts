import { describe, expect, it } from 'vitest';

import {
  encodePayload,
  decodePayload,
  computeOldMonthMultiplier,
  accessGroupForPayload,
} from './service';

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

describe('payments.service.accessGroupForPayload', () => {
  it('maps a subscription to its period + tier', () => {
    expect(
      accessGroupForPayload({ t: 'sub', userId: 1, period: '2026_05', tier: 'regular' }),
    ).toEqual({ period: '2026_05', type: 'regular' });
  });

  it('maps an old-month purchase to its period + tier', () => {
    expect(accessGroupForPayload({ t: 'old', userId: 1, period: '2025_09', tier: 'plus' })).toEqual(
      { period: '2025_09', type: 'plus' },
    );
  });

  it('maps an upgrade to the plus group for that period', () => {
    expect(accessGroupForPayload({ t: 'upgrade', userId: 1, period: '2026_05' })).toEqual({
      period: '2026_05',
      type: 'plus',
    });
  });

  it('returns null for a kickstarter (no group access)', () => {
    expect(accessGroupForPayload({ t: 'ks', userId: 1, kickstarterId: 7 })).toBeNull();
  });
});

describe('payments.service.computeOldMonthMultiplier', () => {
  it('returns 3x for old months', () => {
    expect(computeOldMonthMultiplier()).toBe(3);
  });
});
