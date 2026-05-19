import { Markup } from 'telegraf';

import { router } from '../../core/router';

import type { RaidRow } from './repo';
import { raidsCallback } from './schemas';

export function publicRaidKeyboard(
  raid: Pick<RaidRow, 'id' | 'status'>,
): ReturnType<typeof Markup.inlineKeyboard> {
  if (raid.status !== 'open') {
    return Markup.inlineKeyboard([]);
  }
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
      router.encode(raidsCallback, { a: 'raidComplete', id: raid.id }),
    ),
    Markup.button.callback(
      '❌ Отменить',
      router.encode(raidsCallback, { a: 'raidCancel', id: raid.id }),
    ),
  ]);
  return Markup.inlineKeyboard(rows);
}
