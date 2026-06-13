import { Markup } from 'telegraf';

import { router } from '../../../core/router';
import { escapeHtml, truncate } from '../../../shared/format';
import { getStatusDisplay } from '../../../shared/user-status';
import { adminCallback } from '../../admin/schemas';
import { pollsCallback } from '../../polls/schemas';
import { adminFilterRow, adminListItemButton, adminPagination, homeRow } from '../menus';
import type { ApplicationRow, ApplicationStatus } from '../repo';
import { onboardingAdminCallback } from '../schemas';

export const PAGE_SIZE = 10;

/** Mirror of the /admin command's hub menu, so the «Админка» button on the
 * admin /start can render the same hub in place. */
export function adminHubKeyboard(): ReturnType<typeof Markup.inlineKeyboard> {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('📅 Месяцы', router.encode(adminCallback, { a: 'adMonths' })),
      Markup.button.callback(
        '📨 Прошения',
        router.encode(onboardingAdminCallback, { a: 'onAdminList', page: 0 }),
      ),
    ],
    [
      Markup.button.callback('📊 Опросы', router.encode(pollsCallback, { a: 'polMenu' })),
      Markup.button.callback('🚀 Новый кикстартер', router.encode(adminCallback, { a: 'adKsAdd' })),
    ],
    [
      Markup.button.callback('🔍 Найти гоблина', router.encode(adminCallback, { a: 'adFind' })),
      Markup.button.callback('🧾 СБП на проверку', 'sbp:queue'),
    ],
    [
      Markup.button.callback(
        '🩺 Проверить логово',
        router.encode(adminCallback, { a: 'adHealth' }),
      ),
    ],
    homeRow(),
  ]);
}

export function listScreen(
  apps: readonly ApplicationRow[],
  page: number,
  totalCount: number,
  status: ApplicationStatus = 'pending',
): { text: string; keyboard: ReturnType<typeof Markup.inlineKeyboard> } {
  const text =
    apps.length === 0 ? 'Прошений не найдено.' : `Прошений: ${totalCount}. Стр. ${page + 1}.`;

  const rows: ReturnType<typeof Markup.button.callback>[][] = [];
  for (const app of apps) {
    rows.push([adminListItemButton(app, page, status)]);
  }
  rows.push(adminFilterRow());
  const pagination = adminPagination(page, (page + 1) * PAGE_SIZE < totalCount, status);
  if (pagination.length > 0) rows.push(pagination);

  return { text, keyboard: Markup.inlineKeyboard(rows) };
}

export function userCard(app: ApplicationRow, roles: readonly string[]): string {
  const display = getStatusDisplay(roles);
  const name = escapeHtml([app.firstName, app.lastName].filter(Boolean).join(' ') || '—');
  const username = escapeHtml(app.username ? `@${app.username}` : `id:${app.userId}`);
  const tale = app.tale ? escapeHtml(truncate(app.tale, 3500)) : '—';
  return [
    `📜 <b>Прошение #${app.id}</b>`,
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
