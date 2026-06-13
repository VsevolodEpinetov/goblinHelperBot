import { Markup } from 'telegraf';

import { router } from '../../core/router';
import { homeButton } from '../onboarding/menus';

import { formatRaidShortLine } from './format';
import type { RaidRow } from './repo';
import { raidsCallback } from './schemas';

type RaidListItem = Pick<RaidRow, 'id' | 'title' | 'price' | 'currency'>;

export const RAID_PAGE_SIZE = 8;

function raidItemRow(raid: RaidListItem): ReturnType<typeof Markup.button.callback>[] {
  return [
    Markup.button.callback(
      formatRaidShortLine(raid),
      router.encode(raidsCallback, { a: 'raidView', id: raid.id }),
    ),
  ];
}

function raidPaginationRow(
  action: 'raidList' | 'raidMine',
  page: number,
  hasNext: boolean,
): ReturnType<typeof Markup.button.callback>[] {
  const buttons: ReturnType<typeof Markup.button.callback>[] = [];
  if (page > 0) {
    buttons.push(
      Markup.button.callback('«', router.encode(raidsCallback, { a: action, p: page - 1 })),
    );
  }
  if (hasNext) {
    buttons.push(
      Markup.button.callback('Ещё »', router.encode(raidsCallback, { a: action, p: page + 1 })),
    );
  }
  return buttons;
}

/** Open-raids list: tap a raid to open it; plus paging / create / my-raids / home. */
export function raidListKeyboard(
  rows: readonly RaidListItem[],
  page = 0,
  hasNext = false,
): ReturnType<typeof Markup.inlineKeyboard> {
  const pagination = raidPaginationRow('raidList', page, hasNext);
  return Markup.inlineKeyboard([
    ...rows.map(raidItemRow),
    ...(pagination.length > 0 ? [pagination] : []),
    [Markup.button.callback('⚔️ Затеять рейд', router.encode(raidsCallback, { a: 'raidCreate' }))],
    [Markup.button.callback('🛡 Мои рейды', router.encode(raidsCallback, { a: 'raidMine' }))],
    [homeButton()],
  ]);
}

/** "My raids" list: tap to open; plus paging / back-to-raids + home. */
export function myRaidsKeyboard(
  rows: readonly RaidListItem[],
  page = 0,
  hasNext = false,
): ReturnType<typeof Markup.inlineKeyboard> {
  const pagination = raidPaginationRow('raidMine', page, hasNext);
  return Markup.inlineKeyboard([
    ...rows.map(raidItemRow),
    ...(pagination.length > 0 ? [pagination] : []),
    [Markup.button.callback('« К рейдам', router.encode(raidsCallback, { a: 'raidList' }))],
    [homeButton()],
  ]);
}

/** Full raid view opened from the menu: status-appropriate actions + back nav. */
export function raidViewKeyboard(
  raid: Pick<RaidRow, 'id' | 'status'>,
  isCreator: boolean,
  isStaff = false,
): ReturnType<typeof Markup.inlineKeyboard> {
  const rows: ReturnType<typeof Markup.button.callback>[][] = [];
  if (isCreator) {
    if (raid.status === 'open') {
      rows.push([
        Markup.button.callback(
          '🔒 Закрыть',
          router.encode(raidsCallback, { a: 'raidClose', id: raid.id }),
        ),
      ]);
    }
    if (raid.status !== 'completed' && raid.status !== 'cancelled') {
      rows.push([
        Markup.button.callback(
          '✅ Завершить',
          router.encode(raidsCallback, { a: 'raidCompleteAsk', id: raid.id }),
        ),
        Markup.button.callback(
          '❌ Отменить',
          router.encode(raidsCallback, { a: 'raidCancelAsk', id: raid.id }),
        ),
      ]);
    }
  } else {
    if (raid.status === 'open') {
      rows.push([
        Markup.button.callback(
          '✅ Присоединиться',
          router.encode(raidsCallback, { a: 'raidJoin', id: raid.id }),
        ),
        Markup.button.callback(
          '🚪 Выйти',
          router.encode(raidsCallback, { a: 'raidLeave', id: raid.id }),
        ),
      ]);
    }
    if (isStaff && raid.status !== 'completed' && raid.status !== 'cancelled') {
      rows.push([
        Markup.button.callback(
          '🔨 Закрыть рейд',
          router.encode(raidsCallback, { a: 'raidCancelAsk', id: raid.id }),
        ),
      ]);
    }
  }
  rows.push([
    Markup.button.callback('« К рейдам', router.encode(raidsCallback, { a: 'raidList' })),
    homeButton(),
  ]);
  return Markup.inlineKeyboard(rows);
}

/** Two-step confirm for an irreversible creator action (complete / cancel). */
export function raidConfirmKeyboard(
  raidId: number,
  action: 'raidComplete' | 'raidCancel',
): ReturnType<typeof Markup.inlineKeyboard> {
  const yes =
    action === 'raidComplete'
      ? Markup.button.callback(
          '🔥 Да, завершить',
          router.encode(raidsCallback, { a: 'raidComplete', id: raidId }),
        )
      : Markup.button.callback(
          '💀 Да, в топку',
          router.encode(raidsCallback, { a: 'raidCancel', id: raidId }),
        );
  return Markup.inlineKeyboard([
    [yes],
    [
      Markup.button.callback(
        '« Назад',
        router.encode(raidsCallback, { a: 'raidView', id: raidId }),
      ),
    ],
  ]);
}

export function publicRaidKeyboard(
  raid: Pick<RaidRow, 'id' | 'status'>,
  botUsername?: string,
): ReturnType<typeof Markup.inlineKeyboard> {
  if (raid.status !== 'open') {
    return Markup.inlineKeyboard([]);
  }
  // Deep link from the group card into the bot's full raid screen.
  const deepLinkRow = botUsername
    ? [
        [
          Markup.button.url(
            '⚔️ Открыть в логове',
            `https://t.me/${botUsername}?start=raid_${raid.id}`,
          ),
        ],
      ]
    : [];
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        '✅ Присоединиться',
        router.encode(raidsCallback, { a: 'raidJoin', id: raid.id }),
      ),
      Markup.button.callback(
        '🚪 Выйти',
        router.encode(raidsCallback, { a: 'raidLeave', id: raid.id }),
      ),
    ],
    ...deepLinkRow,
  ]);
}

export function creatorControlsKeyboard(
  raid: Pick<RaidRow, 'id' | 'status'>,
): ReturnType<typeof Markup.inlineKeyboard> {
  if (raid.status === 'completed' || raid.status === 'cancelled') {
    return Markup.inlineKeyboard([]);
  }
  const rows: ReturnType<typeof Markup.button.callback>[][] = [];
  if (raid.status === 'open') {
    rows.push([
      Markup.button.callback(
        '🔒 Закрыть',
        router.encode(raidsCallback, { a: 'raidClose', id: raid.id }),
      ),
    ]);
  }
  rows.push([
    Markup.button.callback(
      '✅ Завершить',
      router.encode(raidsCallback, { a: 'raidCompleteAsk', id: raid.id }),
    ),
    Markup.button.callback(
      '❌ Отменить',
      router.encode(raidsCallback, { a: 'raidCancelAsk', id: raid.id }),
    ),
  ]);
  return Markup.inlineKeyboard(rows);
}
