import { escapeHtml, formatPrice, formatUserDisplay, type Currency } from '../../shared/format';

import type { RaidRow } from './repo';

interface ParticipantDisplay {
  userId: number;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
}

const STATUS_LABEL: Record<RaidRow['status'], string> = {
  open: '🟢 Открыт',
  closed: '🔴 Закрыт',
  cancelled: '❌ Отменён',
  completed: '✅ Завершён',
};

export function formatRaidMessage(
  raid: Pick<
    RaidRow,
    | 'id'
    | 'title'
    | 'description'
    | 'link'
    | 'price'
    | 'currency'
    | 'status'
    | 'createdBy'
    | 'createdByUsername'
    | 'createdByFirstName'
    | 'createdByLastName'
    | 'endDate'
  >,
  participants: readonly ParticipantDisplay[],
): string {
  const lines: string[] = [];
  lines.push(`<b>${escapeHtml(raid.title)}</b> (#${raid.id})`);
  lines.push(STATUS_LABEL[raid.status]);
  lines.push('');
  if (raid.description) {
    lines.push(escapeHtml(raid.description));
    lines.push('');
  }
  if (raid.link) {
    lines.push(`🔗 ${escapeHtml(raid.link)}`);
  }
  lines.push(`💰 ${formatPrice(raid.price, raid.currency as Currency)}`);

  const organizer = formatUserDisplay({
    id: raid.createdBy,
    username: raid.createdByUsername,
    firstName: raid.createdByFirstName,
    lastName: raid.createdByLastName,
  });
  lines.push(`👤 Организатор: ${escapeHtml(organizer)}`);

  if (raid.endDate) {
    lines.push(`📅 До: ${raid.endDate.toLocaleDateString('ru-RU')}`);
  }

  lines.push('');
  lines.push(`Участников: ${participants.length}`);
  if (participants.length > 0) {
    for (const p of participants) {
      lines.push(`• ${escapeHtml(formatUserDisplay({ id: p.userId, ...p }))}`);
    }
  }

  return lines.join('\n');
}

export function formatRaidShortLine(
  raid: Pick<RaidRow, 'id' | 'title' | 'price' | 'currency'>,
): string {
  return `#${raid.id} — ${raid.title} (${formatPrice(raid.price, raid.currency as Currency)})`;
}
