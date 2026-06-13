import { Markup } from 'telegraf';

import { router } from '../../core/router';
import { formatPrice } from '../../shared/format';
import type { Period } from '../../shared/period';
import { invitationsCallback } from '../invitations/schemas';
import { homeRow } from '../onboarding/menus';

import { sbpAmountRub } from './pricing';
import type { SubscriptionTier } from './repo';
import { subscriptionsCallback } from './schemas';

/** «(СБП)» button label, with the RUB price when env-configured. */
function sbpLabel(tier: SubscriptionTier, kind: 'sub' | 'old'): string {
  const name = tier === 'plus' ? '💎 Расширенный' : '🪙 Обычный';
  const amount = sbpAmountRub({ tier, kind });
  return amount ? `${name} (СБП) — ${formatPrice(amount, 'RUB')}` : `${name} (СБП)`;
}

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
        sbpLabel('regular', 'sub'),
        router.encode(subscriptionsCallback, {
          a: 'subSbp',
          year: period.year,
          month: period.month,
          tier: 'regular',
        }),
      ),
      Markup.button.callback(
        sbpLabel('plus', 'sub'),
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
  rows.push(homeRow());
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

/** «🚪 Ключи от архивов» row — the «enter» half of the buy/enter pair, shown on
 * screens where the member already owns something and the next job is getting in. */
function archiveKeysRow(): ReturnType<typeof Markup.button.callback>[] {
  return [
    Markup.button.callback(
      '🚪 Ключи от архивов',
      router.encode(invitationsCallback, { a: 'inviteMenu' }),
    ),
  ];
}

/** Keyboard for the already-own-it screens: old archives + keys + home. */
export function oldArchivesKeyboard(): ReturnType<typeof Markup.inlineKeyboard> {
  return Markup.inlineKeyboard([oldArchivesRow(), archiveKeysRow(), homeRow()]);
}

export const OLD_ARCHIVES_PAGE_SIZE = 12;

/** One page of past archives to choose from; each opens its tier screen. */
export function oldMonthsListKeyboard(
  periods: readonly string[],
  page = 0,
  hasNext = false,
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
  const pagination: ReturnType<typeof Markup.button.callback>[] = [];
  if (page > 0) {
    pagination.push(
      Markup.button.callback(
        '«',
        router.encode(subscriptionsCallback, { a: 'subOldList', p: page - 1 }),
      ),
    );
  }
  if (hasNext) {
    pagination.push(
      Markup.button.callback(
        'Ещё »',
        router.encode(subscriptionsCallback, { a: 'subOldList', p: page + 1 }),
      ),
    );
  }
  if (pagination.length > 0) rows.push(pagination);
  rows.push([
    Markup.button.callback('« К текущему', router.encode(subscriptionsCallback, { a: 'subOpen' })),
  ]);
  rows.push(homeRow());
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
          sbpLabel(o.tier, 'old'),
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
  rows.push(homeRow());
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
    archiveKeysRow(),
    homeRow(),
  ]);
}

/** A single «🪙 Взять архив» button that opens the buy screen (subOpen), plus a
 * way home. Shown after approval and after a payment. */
export function archiveKeyboard(): ReturnType<typeof Markup.inlineKeyboard> {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        '🪙 Взять архив',
        router.encode(subscriptionsCallback, { a: 'subOpen' }),
      ),
    ],
    homeRow(),
  ]);
}
