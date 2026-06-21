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
    [
      Markup.button.callback(
        '📆 Месяцы',
        router.encode(adminCallback, { a: 'adUMon', id: overview.id }),
      ),
      Markup.button.callback('💳 Платежи', `pay:hist:${overview.id}`),
    ],
  ]);
  return { text, keyboard };
}

/** Pick a role to GRANT — one button per grantable role, two per row, + back. */
export function rolePickKeyboard(
  userId: number,
  entries: ReadonlyArray<{ role: string; label: string }>,
): ReturnType<typeof Markup.inlineKeyboard> {
  const rows: ReturnType<typeof Markup.button.callback>[][] = [];
  for (let i = 0; i < entries.length; i += 2) {
    rows.push(
      entries
        .slice(i, i + 2)
        .map((e) =>
          Markup.button.callback(
            e.label,
            router.encode(adminCallback, { a: 'adRolePick', id: userId, role: e.role }),
          ),
        ),
    );
  }
  rows.push([
    Markup.button.callback('« Назад', router.encode(adminCallback, { a: 'adUser', id: userId })),
  ]);
  return Markup.inlineKeyboard(rows);
}

/** Pick a role to REMOVE — one button per current (removable) role, + back. */
export function roleDropKeyboard(
  userId: number,
  entries: ReadonlyArray<{ role: string; label: string }>,
): ReturnType<typeof Markup.inlineKeyboard> {
  const rows: ReturnType<typeof Markup.button.callback>[][] = [];
  for (let i = 0; i < entries.length; i += 2) {
    rows.push(
      entries
        .slice(i, i + 2)
        .map((e) =>
          Markup.button.callback(
            e.label,
            router.encode(adminCallback, { a: 'adRoleDrop', id: userId, role: e.role }),
          ),
        ),
    );
  }
  rows.push([
    Markup.button.callback('« Назад', router.encode(adminCallback, { a: 'adUser', id: userId })),
  ]);
  return Markup.inlineKeyboard(rows);
}

/** Per-user months screen: what archives they hold, plus grant/revoke controls. */
export function userMonthsScreen(
  userId: number,
  months: readonly { period: string; tier: 'regular' | 'plus' }[],
): { text: string; keyboard: ReturnType<typeof Markup.inlineKeyboard> } {
  const text =
    months.length === 0
      ? '🌑 Пусто. Ни одного месяца за гоблином не записано.'
      : [
          '📜 Месяцы, что числятся за этим гоблином:',
          '',
          ...months.map((m) => `• <b>${m.period}</b> — ${tierWord(m.tier)}`),
        ].join('\n');

  const rows: ReturnType<typeof Markup.button.callback>[][] = [
    [
      Markup.button.callback(
        '➕ 🪙 Обычный',
        router.encode(adminCallback, { a: 'adGMon', id: userId, t: 'regular' }),
      ),
      Markup.button.callback(
        '➕ 💎 Расш.',
        router.encode(adminCallback, { a: 'adGMon', id: userId, t: 'plus' }),
      ),
      Markup.button.callback(
        '➕ Оба',
        router.encode(adminCallback, { a: 'adGMon', id: userId, t: 'both' }),
      ),
    ],
  ];
  for (const m of months) {
    rows.push([
      Markup.button.callback(
        `➖ ${m.period} / ${tierWord(m.tier)}`,
        router.encode(adminCallback, { a: 'adRMon', id: userId, period: m.period, tier: m.tier }),
      ),
    ]);
  }
  rows.push([
    Markup.button.callback(
      '« К гоблину',
      router.encode(adminCallback, { a: 'adUser', id: userId }),
    ),
  ]);
  return { text, keyboard: Markup.inlineKeyboard(rows) };
}

/** Scene-exit nav: back to the user's months screen. */
export function backToUserMonthsKeyboard(userId: number): ReturnType<typeof Markup.inlineKeyboard> {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        '« К месяцам гоблина',
        router.encode(adminCallback, { a: 'adUMon', id: userId }),
      ),
    ],
  ]);
}

/** Months come in pairs (regular + plus per period), so a page of 8 entries
 * shows four months at a time and keeps the keyboard well under Telegram's limit. */
const MONTHS_PAGE_SIZE = 8;

export function monthsKeyboard(
  months: readonly MonthSummary[],
  page = 0,
): {
  text: string;
  keyboard: ReturnType<typeof Markup.inlineKeyboard>;
} {
  const addRow = [
    Markup.button.callback('➕ Добавить месяц', router.encode(adminCallback, { a: 'adAddMonth' })),
  ];
  const backRow = [
    Markup.button.callback(
      '« В зал совета',
      router.encode(onboardingAdminCallback, { a: 'onAdminHub' }),
    ),
  ];
  if (months.length === 0) {
    return {
      text: '📆 Месяцев нет',
      keyboard: Markup.inlineKeyboard([addRow, backRow]),
    };
  }

  const maxPage = Math.max(0, Math.ceil(months.length / MONTHS_PAGE_SIZE) - 1);
  const current = Math.min(Math.max(page, 0), maxPage);
  const start = current * MONTHS_PAGE_SIZE;
  const pageMonths = months.slice(start, start + MONTHS_PAGE_SIZE);

  const header = maxPage > 0 ? `📆 Месяцы (стр. ${current + 1}/${maxPage + 1}):` : '📆 Месяцы:';
  const lines = pageMonths.map(
    (m) =>
      `${m.period}/${m.type}: chat=${m.chatId ?? '—'} joined=${m.counterJoined} paid=${m.counterPaid}`,
  );

  const buttons: ReturnType<typeof Markup.button.callback>[][] = [addRow];
  for (const m of pageMonths) {
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

  const nav: ReturnType<typeof Markup.button.callback>[] = [];
  if (current > 0) {
    nav.push(
      Markup.button.callback(
        '«',
        router.encode(adminCallback, { a: 'adMonths', page: current - 1 }),
      ),
    );
  }
  if (start + MONTHS_PAGE_SIZE < months.length) {
    nav.push(
      Markup.button.callback(
        '»',
        router.encode(adminCallback, { a: 'adMonths', page: current + 1 }),
      ),
    );
  }
  if (nav.length > 0) buttons.push(nav);
  buttons.push(backRow);

  return { text: [header, ...lines].join('\n'), keyboard: Markup.inlineKeyboard(buttons) };
}
