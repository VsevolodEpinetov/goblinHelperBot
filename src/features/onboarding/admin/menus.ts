import { Markup } from 'telegraf';

import { escapeHtml, truncate } from '../../../shared/format';
import { getStatusDisplay } from '../../../shared/user-status';
import { adminFilterRow, adminListItemButton, adminPagination } from '../menus';
import type { ApplicationRow } from '../repo';

export const PAGE_SIZE = 10;

export function listScreen(
  apps: readonly ApplicationRow[],
  page: number,
  totalCount: number,
): { text: string; keyboard: ReturnType<typeof Markup.inlineKeyboard> } {
  const text =
    apps.length === 0 ? 'Свитков не найдено.' : `Свитков: ${totalCount}. Стр. ${page + 1}.`;

  const rows: ReturnType<typeof Markup.button.callback>[][] = [];
  for (const app of apps) {
    rows.push([adminListItemButton(app)]);
  }
  rows.push(adminFilterRow());
  const pagination = adminPagination(page, (page + 1) * PAGE_SIZE < totalCount);
  if (pagination.length > 0) rows.push(pagination);

  return { text, keyboard: Markup.inlineKeyboard(rows) };
}

export function userCard(app: ApplicationRow, roles: readonly string[]): string {
  const display = getStatusDisplay(roles);
  const name = escapeHtml([app.firstName, app.lastName].filter(Boolean).join(' ') || '—');
  const username = escapeHtml(app.username ? `@${app.username}` : `id:${app.userId}`);
  const tale = app.tale ? escapeHtml(truncate(app.tale, 3500)) : '—';
  return [
    `📜 <b>Свиток #${app.id}</b>`,
    `${display.emoji} ${display.text}`,
    '',
    `Чужак: ${username}`,
    `Имя: ${name}`,
    `Подан: ${app.createdAt.toLocaleString('ru-RU')}`,
    `Состояние: ${app.status}`,
    '',
    'Его слова совету:',
    tale,
  ].join('\n');
}
