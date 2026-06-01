import { Markup } from 'telegraf';

import { router } from '../../core/router';
import { formatPrice } from '../../shared/format';
import type { Period } from '../../shared/period';

import { subscriptionsCallback } from './schemas';

export function buyKeyboard(
  period: Period,
  sbpAllowed: boolean,
  prices: { regular: number; plus: number },
): ReturnType<typeof Markup.inlineKeyboard> {
  const rows: ReturnType<typeof Markup.button.callback>[][] = [
    [
      Markup.button.callback(
        `🪙 Обычный — ${formatPrice(prices.regular, 'XTR')}`,
        router.encode(subscriptionsCallback, {
          a: 'subBuy',
          year: period.year,
          month: period.month,
          tier: 'regular',
        }),
      ),
      Markup.button.callback(
        `💎 Расширенный — ${formatPrice(prices.plus, 'XTR')}`,
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
        '🪙 Обычный (СБП)',
        router.encode(subscriptionsCallback, {
          a: 'subSbp',
          year: period.year,
          month: period.month,
          tier: 'regular',
        }),
      ),
      Markup.button.callback(
        '💎 Расширенный (СБП)',
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

export function upgradeKeyboard(
  period: Period,
  delta: number,
): ReturnType<typeof Markup.inlineKeyboard> {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        `💎 Расширить — ${formatPrice(delta, 'XTR')}`,
        router.encode(subscriptionsCallback, {
          a: 'subUpgrade',
          year: period.year,
          month: period.month,
        }),
      ),
    ],
  ]);
}

/** A single «🪙 Взять архив» button that opens the buy screen (subOpen). */
export function archiveKeyboard(): ReturnType<typeof Markup.inlineKeyboard> {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        '🪙 Взять архив',
        router.encode(subscriptionsCallback, { a: 'subOpen' }),
      ),
    ],
  ]);
}
