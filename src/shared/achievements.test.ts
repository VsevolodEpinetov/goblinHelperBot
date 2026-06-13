import { describe, expect, it } from 'vitest';

import {
  ACHIEVEMENT_KEYS,
  ACHIEVEMENTS,
  canPayViaSbp,
  hasYearsOfService,
  isKnownAchievement,
} from './achievements';

describe('achievements', () => {
  it('exposes a closed set of achievement keys', () => {
    expect(ACHIEVEMENT_KEYS).toContain('sbp_payment');
    expect(ACHIEVEMENT_KEYS).toContain('years_of_service');
  });

  it('every key has a definition with name and description', () => {
    for (const key of ACHIEVEMENT_KEYS) {
      const def = ACHIEVEMENTS[key];
      expect(def).toBeDefined();
      expect(typeof def.displayName).toBe('string');
      expect(def.displayName.length).toBeGreaterThan(0);
      expect(typeof def.description).toBe('string');
    }
  });

  describe('isKnownAchievement', () => {
    it('returns true for known keys', () => {
      expect(isKnownAchievement('sbp_payment')).toBe(true);
      expect(isKnownAchievement('years_of_service')).toBe(true);
    });

    it('returns false for unknown keys', () => {
      expect(isKnownAchievement('totally_made_up')).toBe(false);
      expect(isKnownAchievement('')).toBe(false);
    });
  });

  describe('canPayViaSbp', () => {
    it('returns true when user has sbp_payment achievement', () => {
      expect(canPayViaSbp(['sbp_payment'])).toBe(true);
    });

    it('returns true when sbp_payment is among other achievements', () => {
      expect(canPayViaSbp(['years_of_service', 'sbp_payment'])).toBe(true);
    });

    it('returns false when sbp_payment is absent', () => {
      expect(canPayViaSbp(['years_of_service'])).toBe(false);
      expect(canPayViaSbp([])).toBe(false);
    });
  });

  describe('hasYearsOfService', () => {
    it('returns true when present', () => {
      expect(hasYearsOfService(['years_of_service'])).toBe(true);
    });

    it('returns false when absent', () => {
      expect(hasYearsOfService([])).toBe(false);
      expect(hasYearsOfService(['sbp_payment'])).toBe(false);
    });
  });
});
