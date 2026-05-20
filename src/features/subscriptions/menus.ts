import { Markup } from 'telegraf';

import { router } from '../../core/router';
import type { Period } from '../../shared/period';

import { subscriptionsCallback } from './schemas';

export function buyKeyboard(
  period: Period,
  sbpAllowed: boolean,
): ReturnType<typeof Markup.inlineKeyboard> {
  const rows: ReturnType<typeof Markup.button.callback>[][] = [
    [
      Markup.button.callback(
        'Обычная (⭐)',
        router.encode(subscriptionsCallback, {
          a: 'subBuy',
          year: period.year,
          month: period.month,
          tier: 'regular',
        }),
      ),
      Markup.button.callback(
        'Плюс (⭐)',
        router.encode(subscriptionsCallback, {
          a: 'subBuy',
          year: period.year,
          month: period.month,
          tier: 'plus',
        }),
      ),
    ],
  ];
  if (sbpAllowed) {
    rows.push([
      Markup.button.callback(
        'Обычная (СБП)',
        router.encode(subscriptionsCallback, {
          a: 'subSbp',
          year: period.year,
          month: period.month,
          tier: 'regular',
        }),
      ),
      Markup.button.callback(
        'Плюс (СБП)',
        router.encode(subscriptionsCallback, {
          a: 'subSbp',
          year: period.year,
          month: period.month,
          tier: 'plus',
        }),
      ),
    ]);
  }
  return Markup.inlineKeyboard(rows);
}

export function upgradeKeyboard(period: Period): ReturnType<typeof Markup.inlineKeyboard> {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        'Апгрейд до Plus',
        router.encode(subscriptionsCallback, {
          a: 'subUpgrade',
          year: period.year,
          month: period.month,
        }),
      ),
    ],
  ]);
}
