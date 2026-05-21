import { Markup } from 'telegraf';

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
    apps.length === 0 ? 'Заявок не найдено.' : `Заявок: ${totalCount}. Стр. ${page + 1}.`;

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
  const name = [app.firstName, app.lastName].filter(Boolean).join(' ') || '—';
  return [
    `<b>Заявка #${app.id}</b>`,
    `${display.emoji} ${display.text}`,
    '',
    `Пользователь: ${app.username ? `@${app.username}` : `id:${app.userId}`}`,
    `Имя: ${name}`,
    `Создана: ${app.createdAt.toLocaleString('ru-RU')}`,
    `Статус заявки: ${app.status}`,
  ].join('\n');
}
