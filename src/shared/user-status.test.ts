import { describe, expect, it } from 'vitest';

import { getStatusDisplay, isMember, isStaff } from './user-status';

describe('shared.user-status.getStatusDisplay', () => {
  it('returns "newbie" for empty roles', () => {
    const s = getStatusDisplay([]);
    expect(s.code).toBe('newbie');
    expect(s.emoji).toBeTruthy();
    expect(s.text).toBeTruthy();
  });

  it('prefers banned over everything', () => {
    expect(getStatusDisplay(['banned', 'preapproved', 'plus']).code).toBe('banned');
    expect(getStatusDisplay(['selfBanned', 'preapproved']).code).toBe('selfBanned');
  });

  it('returns "super" when present', () => {
    expect(getStatusDisplay(['super', 'admin']).code).toBe('super');
  });

  it('returns "admin" before "preapproved"', () => {
    expect(getStatusDisplay(['admin', 'preapproved']).code).toBe('admin');
  });

  it('returns "preapproved" when approved but not yet a paying member', () => {
    expect(getStatusDisplay(['preapproved']).code).toBe('preapproved');
  });

  it('returns "pending" for applicants', () => {
    expect(getStatusDisplay(['pending']).code).toBe('pending');
  });

  it('returns "rejected" only when not also preapproved/admin', () => {
    expect(getStatusDisplay(['rejected']).code).toBe('rejected');
    expect(getStatusDisplay(['rejected', 'preapproved']).code).toBe('preapproved');
  });
});

describe('shared.user-status.isMember', () => {
  it('true when preapproved (paying access flows downstream)', () => {
    expect(isMember(['preapproved'])).toBe(true);
  });
  it('false for newbie/pending/rejected/banned', () => {
    expect(isMember([])).toBe(false);
    expect(isMember(['pending'])).toBe(false);
    expect(isMember(['rejected'])).toBe(false);
    expect(isMember(['banned'])).toBe(false);
  });
});

describe('shared.user-status.isStaff', () => {
  it('true for admin/adminPlus/super', () => {
    expect(isStaff(['admin'])).toBe(true);
    expect(isStaff(['adminPlus'])).toBe(true);
    expect(isStaff(['super'])).toBe(true);
  });
  it('false otherwise', () => {
    expect(isStaff([])).toBe(false);
    expect(isStaff(['preapproved'])).toBe(false);
    expect(isStaff(['polls'])).toBe(false);
  });
});
