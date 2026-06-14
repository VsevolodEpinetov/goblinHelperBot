import { Markup } from 'telegraf';

import { router } from '../../core/router';
import { getStatusDisplay } from '../../shared/user-status';
import { onboardingAdminCallback } from '../onboarding/schemas';

import type { MonthSummary, UserSearchResult } from './repo';
import { adminCallback } from './schemas';
import { tierWord, type UserOverview } from './service';

/** Confirmation keyboard for `/this_is`: pick the tier (or confirm the given
 * one), or cancel. The bind reads ctx.chat.id at tap time. */
export function bindChatKeyboard(
  period: string,
  tier?: 'regular' | 'plus',
): ReturnType<typeof Markup.inlineKeyboard> {
  const cancel = Markup.button.callback(
    '🌑 Брось',
    router.encode(adminCallback, { a: 'bindCancel' }),
  );
  if (tier) {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback(
          `⚖️ Отметить ${tierWord(tier)} ${period}`,
          router.encode(adminCallback, { a: 'bindHere', period, tier }),
        ),
      ],
      [cancel],
    ]);
  }
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        '🪙 Обычный',
        router.encode(adminCallback, { a: 'bindHere', period, tier: 'regular' }),
      ),
      Markup.button.callback(
        '💎 Расширенный',
        router.encode(adminCallback, { a: 'bindHere', period, tier: 'plus' }),
      ),
    ],
    [cancel],
  ]);
}

/** Scene-exit nav: back to the user card the admin was working from. */
export function backToUserKeyboard(userId: number): ReturnType<typeof Markup.inlineKeyboard> {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        '« К гоблину',
        router.encode(adminCallback, { a: 'adUser', id: userId }),
      ),
    ],
  ]);
}

/** Scene-exit nav: back to the months screen. */
export function backToMonthsKeyboard(): ReturnType<typeof Markup.inlineKeyboard> {
  return Markup.inlineKeyboard([
    [Markup.button.callback('« К месяцам', router.encode(adminCallback, { a: 'adMonths' }))],
  ]);
}

/** Scene-exit nav: back to the admin hub. */
export function backToHubKeyboard(): ReturnType<typeof Markup.inlineKeyboard> {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        '« В зал совета',
        router.encode(onboardingAdminCallback, { a: 'onAdminHub' }),
      ),
    ],
  ]);
}

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
  const isFriendNow = overview.roles.includes('friend');
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
        '📜 Выдать свиток',
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
    [
      Markup.button.callback(
        isFriendNow ? '📉 Отнять дружбу' : '🤝 Сделать другом',
        router.encode(adminCallback, { a: 'adFriend', id: overview.id, on: !isFriendNow }),
      ),
    ],
    [Markup.button.callback('💳 Платежи', `pay:hist:${overview.id}`)],
  ]);
  return { text, keyboard };
}

export function monthsKeyboard(months: readonly MonthSummary[]): {
  text: string;
  keyboard: ReturnType<typeof Markup.inlineKeyboard>;
} {
  if (months.length === 0) {
    return {
      text: '📆 Месяцев нет',
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
    buttons.push([
      Markup.button.callback(
        m.chatId
          ? `🔁 Чат: ${m.period}/${m.type} (${m.chatId})`
          : `Привязать чат: ${m.period}/${m.type}`,
        router.encode(adminCallback, {
          a: 'adSetMonthChat',
          period: m.period,
          tier: m.type as 'regular' | 'plus',
        }),
      ),
    ]);
  }
  return { text: lines.join('\n'), keyboard: Markup.inlineKeyboard(buttons) };
}
