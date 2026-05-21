import { Markup } from 'telegraf';

import { router } from '../../core/router';
import { getStatusDisplay } from '../../shared/user-status';

import type { MonthSummary, UserSearchResult } from './repo';
import { adminCallback } from './schemas';
import type { UserOverview } from './service';

export function userListKeyboard(
  rows: readonly UserSearchResult[],
): ReturnType<typeof Markup.inlineKeyboard> {
  const buttons = rows.map((u) => [
    Markup.button.callback(
      u.username
        ? `@${u.username}`
        : [u.firstName, u.lastName].filter(Boolean).join(' ') || `id:${u.id}`,
      router.encode(adminCallback, { a: 'adUser', id: u.id }),
    ),
  ]);
  return Markup.inlineKeyboard(buttons);
}

export function userCard(
  overview: UserOverview,
  label: string,
): { text: string; keyboard: ReturnType<typeof Markup.inlineKeyboard> } {
  const status = getStatusDisplay(overview.roles);
  const text = [
    `<b>${label}</b> (id:${overview.id})`,
    `${status.emoji} ${status.text}`,
    `Роли: ${overview.roles.length === 0 ? '—' : overview.roles.join(', ')}`,
    `Достижения: ${overview.achievements.length === 0 ? '—' : overview.achievements.join(', ')}`,
    `Баланс: ${overview.balance}`,
  ].join('\n');

  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback(
        '🎫 Роль ➕',
        router.encode(adminCallback, { a: 'adGrantRole', id: overview.id }),
      ),
      Markup.button.callback(
        '🎫 Роль ➖',
        router.encode(adminCallback, { a: 'adRemoveRole', id: overview.id }),
      ),
    ],
    [
      Markup.button.callback(
        '📜 Свиток',
        router.encode(adminCallback, { a: 'adGrantScroll', id: overview.id }),
      ),
      Markup.button.callback(
        '💰 Баланс',
        router.encode(adminCallback, { a: 'adChangeBalance', id: overview.id }),
      ),
    ],
    [
      Markup.button.callback(
        '🏆 SBP',
        router.encode(adminCallback, { a: 'adGrantAch', id: overview.id, key: 'sbp_payment' }),
      ),
      Markup.button.callback(
        '🏆 Years',
        router.encode(adminCallback, { a: 'adGrantAch', id: overview.id, key: 'years_of_service' }),
      ),
    ],
  ]);
  return { text, keyboard };
}

export function monthsKeyboard(months: readonly MonthSummary[]): {
  text: string;
  keyboard: ReturnType<typeof Markup.inlineKeyboard>;
} {
  if (months.length === 0) {
    return {
      text: 'Месяцев нет.',
      keyboard: Markup.inlineKeyboard([
        [
          Markup.button.callback(
            '➕ Добавить месяц',
            router.encode(adminCallback, { a: 'adAddMonth' }),
          ),
        ],
      ]),
    };
  }
  const lines = months.map(
    (m) =>
      `${m.period}/${m.type}: chat=${m.chatId ?? '—'} joined=${m.counterJoined} paid=${m.counterPaid}`,
  );
  const buttons: ReturnType<typeof Markup.button.callback>[][] = [
    [
      Markup.button.callback(
        '➕ Добавить месяц',
        router.encode(adminCallback, { a: 'adAddMonth' }),
      ),
    ],
  ];
  for (const m of months) {
    if (!m.chatId) {
      buttons.push([
        Markup.button.callback(
          `Set chat: ${m.period}/${m.type}`,
          router.encode(adminCallback, {
            a: 'adSetMonthChat',
            period: m.period,
            tier: m.type as 'regular' | 'plus',
          }),
        ),
      ]);
    }
  }
  return { text: lines.join('\n'), keyboard: Markup.inlineKeyboard(buttons) };
}
