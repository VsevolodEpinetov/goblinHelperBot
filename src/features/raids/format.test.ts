import { describe, expect, it } from 'vitest';

import { formatRaidMessage, formatRaidShortLine } from './format';

const baseRaid = {
  id: 7,
  title: 'Acme Robot',
  description: 'A cool robot',
  link: 'https://example.com',
  price: 1500,
  currency: 'RUB',
  status: 'open' as const,
  createdBy: 1,
  createdByUsername: 'alice',
  createdByFirstName: 'Alice',
  createdByLastName: null,
  endDate: new Date('2026-12-31'),
};

describe('raids.format.formatRaidMessage', () => {
  it('includes title, price, organizer', () => {
    const text = formatRaidMessage(baseRaid, []);
    expect(text).toContain('Acme Robot');
    expect(text).toContain('1500');
    expect(text).toContain('alice');
  });

  it('includes description when present', () => {
    const text = formatRaidMessage(baseRaid, []);
    expect(text).toContain('A cool robot');
  });

  it('lists participant usernames when provided', () => {
    const text = formatRaidMessage(baseRaid, [
      { userId: 2, username: 'bob', firstName: 'Bob', lastName: null },
      { userId: 3, username: 'not_set', firstName: 'Charlie', lastName: 'C' },
    ]);
    expect(text).toContain('@bob');
    expect(text).toContain('Charlie C');
  });

  it('shows the participant count', () => {
    const text = formatRaidMessage(baseRaid, [
      { userId: 2, username: 'bob', firstName: 'Bob', lastName: null },
    ]);
    expect(text).toMatch(/Участников:\s*1/);
  });

  it('marks closed raids', () => {
    const text = formatRaidMessage({ ...baseRaid, status: 'closed' }, []);
    expect(text).toContain('Закрыт');
  });
});

describe('raids.format.formatRaidShortLine', () => {
  it('returns a one-line summary', () => {
    const line = formatRaidShortLine(baseRaid);
    expect(line).toContain('Acme Robot');
    expect(line).toContain('#7');
  });
});
