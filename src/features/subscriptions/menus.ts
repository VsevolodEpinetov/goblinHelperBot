import { Markup } from 'telegraf';

import { router } from '../../core/router';
import { formatPrice } from '../../shared/format';
import type { Period } from '../../shared/period';

import type { SubscriptionTier } from './repo';
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
  rows.push(oldArchivesRow());
  return Markup.inlineKeyboard(rows);
}

/** Single «📚 Старые архивы» row, reused across the buy screens. */
function oldArchivesRow(): ReturnType<typeof Markup.button.callback>[] {
  return [
    Markup.button.callback(
      '📚 Старые архивы',
      router.encode(subscriptionsCallback, { a: 'subOldList' }),
    ),
  ];
}

/** Standalone «📚 Старые архивы» keyboard (for screens with no other buttons). */
export function oldArchivesKeyboard(): ReturnType<typeof Markup.inlineKeyboard> {
  return Markup.inlineKeyboard([oldArchivesRow()]);
}

/** List of past archives to choose from; each opens its tier screen. */
export function oldMonthsListKeyboard(
  periods: readonly string[],
): ReturnType<typeof Markup.inlineKeyboard> {
  const rows: ReturnType<typeof Markup.button.callback>[][] = periods.map((p) => {
    const [y, m] = p.split('_');
    return [
      Markup.button.callback(
        `📦 ${p}`,
        router.encode(subscriptionsCallback, {
          a: 'subOldMonth',
          year: Number(y),
          month: Number(m),
        }),
      ),
    ];
  });
  rows.push([
    Markup.button.callback('« К текущему', router.encode(subscriptionsCallback, { a: 'subOpen' })),
  ]);
  return Markup.inlineKeyboard(rows);
}

/** Tier buy buttons for one past archive (Stars + СБП), plus a back row. */
export function oldMonthTierKeyboard(
  period: Period,
  offers: ReadonlyArray<{ tier: SubscriptionTier; price: number }>,
  sbpAllowed: boolean,
): ReturnType<typeof Markup.inlineKeyboard> {
  const label = (tier: SubscriptionTier): string =>
    tier === 'plus' ? '💎 Расширенный' : '🪙 Обычный';
  const rows: ReturnType<typeof Markup.button.callback>[][] = [];
  for (const o of offers) {
    const row = [
      Markup.button.callback(
        `${label(o.tier)} — ${formatPrice(o.price, 'XTR')}`,
        router.encode(subscriptionsCallback, {
          a: 'subOldBuy',
          year: period.year,
          month: period.month,
          tier: o.tier,
        }),
      ),
    ];
    if (sbpAllowed) {
      row.push(
        Markup.button.callback(
          `${label(o.tier)} (СБП)`,
          router.encode(subscriptionsCallback, {
            a: 'subSbp',
            year: period.year,
            month: period.month,
            tier: o.tier,
          }),
        ),
      );
    }
    rows.push(row);
  }
  rows.push([
    Markup.button.callback(
      '« Старые архивы',
      router.encode(subscriptionsCallback, { a: 'subOldList' }),
    ),
  ]);
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
    oldArchivesRow(),
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
