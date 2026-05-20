import { escapeHtml } from '../../shared/format';

import type { KickstarterRow } from './repo';

export function formatKickstarterCard(
  ks: Pick<
    KickstarterRow,
    'id' | 'name' | 'creator' | 'cost' | 'pledgeName' | 'pledgeCost' | 'link'
  >,
): string {
  const lines: string[] = [];
  lines.push(`<b>${escapeHtml(ks.name)}</b> (#${ks.id})`);
  if (ks.creator) lines.push(`👤 ${escapeHtml(ks.creator)}`);
  lines.push(`💰 ${ks.cost} ⭐`);
  if (ks.pledgeName && ks.pledgeCost !== null) {
    lines.push('');
    lines.push(`<b>Pledge: ${escapeHtml(ks.pledgeName)}</b>`);
    lines.push(`💰 ${ks.pledgeCost} ⭐`);
  }
  if (ks.link) {
    lines.push('');
    lines.push(`🔗 ${escapeHtml(ks.link)}`);
  }
  return lines.join('\n');
}

export function formatKickstarterShort(ks: Pick<KickstarterRow, 'id' | 'name' | 'cost'>): string {
  return `#${ks.id} — ${ks.name} (${ks.cost} ⭐)`;
}
