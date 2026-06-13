import { describe, expect, it } from 'vitest';

import { formatKickstarterCard, formatKickstarterShort } from './format';

const base = {
  id: 7,
  name: 'Acme Mech',
  creator: 'Acme',
  cost: 1500,
  pledgeName: 'Bronze Tier',
  pledgeCost: 800,
  link: 'https://example.com',
};

describe('kickstarters.format', () => {
  it('formatKickstarterCard includes the name and cost', () => {
    const text = formatKickstarterCard(base);
    expect(text).toContain('Acme Mech');
    expect(text).toContain('1500');
  });

  it('formatKickstarterCard includes creator and link', () => {
    const text = formatKickstarterCard(base);
    expect(text).toContain('Acme');
    expect(text).toContain('example.com');
  });

  it('formatKickstarterCard omits link section when missing', () => {
    const text = formatKickstarterCard({ ...base, link: null });
    expect(text).not.toContain('🔗');
  });

  it('formatKickstarterCard shows pledge data when present', () => {
    const text = formatKickstarterCard(base);
    expect(text).toContain('Bronze Tier');
    expect(text).toContain('800');
  });

  it('formatKickstarterCard omits pledge section when missing', () => {
    const text = formatKickstarterCard({ ...base, pledgeName: null, pledgeCost: null });
    expect(text).not.toContain('Pledge');
  });

  it('formatKickstarterShort one-liner', () => {
    expect(formatKickstarterShort(base)).toMatch(/#7.*Acme Mech.*1500/);
  });
});
