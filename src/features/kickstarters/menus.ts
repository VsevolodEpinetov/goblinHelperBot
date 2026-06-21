import { Markup } from 'telegraf';

import { router } from '../../core/router';
import { homeButton } from '../onboarding/menus';
import { subscriptionsCallback } from '../subscriptions/schemas';

import { formatKickstarterShort } from './format';
import type { KickstarterRow } from './repo';
import { ksCallback } from './schemas';

/** Pick a scroll the user wants to spend; assume one default scroll id "kickstarter" for v2. */
const DEFAULT_SCROLL_ID = 'kickstarter';

type KsListItem = Pick<KickstarterRow, 'id' | 'name' | 'cost'>;

/** Catalogue list: one tappable button per kickstarter (✅-marked when already
 * owned), plus my-list + home nav. */
export function catalogKeyboard(
  rows: readonly KsListItem[],
  ownedIds: ReadonlySet<number> = new Set(),
): ReturnType<typeof Markup.inlineKeyboard> {
  const itemRows = rows.map((ks) => [
    Markup.button.callback(
      `${ownedIds.has(ks.id) ? '✅ ' : ''}${formatKickstarterShort(ks)}`,
      router.encode(ksCallback, { a: 'ksView', id: ks.id }),
    ),
  ]);
  return Markup.inlineKeyboard([
    ...itemRows,
    [Markup.button.callback('🎯 Мои кикстартеры', router.encode(ksCallback, { a: 'ksMine' }))],
    [homeButton()],
  ]);
}

/** "My kickstarters" list: tappable owned items, plus back-to-catalogue + home. */
export function myKickstartersKeyboard(
  rows: readonly KsListItem[],
): ReturnType<typeof Markup.inlineKeyboard> {
  const itemRows = rows.map((ks) => [
    Markup.button.callback(
      formatKickstarterShort(ks),
      router.encode(ksCallback, { a: 'ksView', id: ks.id }),
    ),
  ]);
  return Markup.inlineKeyboard([
    ...itemRows,
    [Markup.button.callback('« К каталогу', router.encode(ksCallback, { a: 'ksList' }))],
    [homeButton()],
  ]);
}

export function userViewKeyboard(
  ks: Pick<KickstarterRow, 'id'>,
  alreadyOwned: boolean,
  staff = false,
): ReturnType<typeof Markup.inlineKeyboard> {
  const adminRows = staff
    ? [
        [
          Markup.button.callback(
            '✏️ Редактировать',
            router.encode(ksCallback, { a: 'ksAdminMenu', id: ks.id }),
          ),
        ],
      ]
    : [];
  const backRow = [
    Markup.button.callback('« К каталогу', router.encode(ksCallback, { a: 'ksList' })),
    homeButton(),
  ];
  if (alreadyOwned) {
    return Markup.inlineKeyboard([...adminRows, backRow]);
  }
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        '🎟 Отдать 1 свиток',
        router.encode(ksCallback, { a: 'ksScrollAsk', id: ks.id }),
      ),
    ],
    [
      Markup.button.callback(
        '🪙 Платить звёздами',
        router.encode(subscriptionsCallback, { a: 'ksStars', id: ks.id }),
      ),
    ],
    ...adminRows,
    backRow,
  ]);
}

/** One-tap confirmation before the scroll is actually spent. */
export function scrollConfirmKeyboard(
  ks: Pick<KickstarterRow, 'id'>,
): ReturnType<typeof Markup.inlineKeyboard> {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        '✅ Да, отдать свиток',
        router.encode(ksCallback, { a: 'ksBuyScroll', id: ks.id }),
      ),
    ],
    [Markup.button.callback('« Назад', router.encode(ksCallback, { a: 'ksView', id: ks.id }))],
  ]);
}

export function adminEditKeyboard(
  ks: Pick<KickstarterRow, 'id'>,
): ReturnType<typeof Markup.inlineKeyboard> {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        '✏️ Имя',
        router.encode(ksCallback, { a: 'ksEdit', id: ks.id, f: 'name' }),
      ),
      Markup.button.callback(
        '✏️ Автор',
        router.encode(ksCallback, { a: 'ksEdit', id: ks.id, f: 'creator' }),
      ),
    ],
    [
      Markup.button.callback(
        '✏️ Цена',
        router.encode(ksCallback, { a: 'ksEdit', id: ks.id, f: 'cost' }),
      ),
      Markup.button.callback(
        '✏️ Ссылка',
        router.encode(ksCallback, { a: 'ksEdit', id: ks.id, f: 'link' }),
      ),
    ],
    [
      Markup.button.callback(
        '✏️ Пледж',
        router.encode(ksCallback, { a: 'ksEdit', id: ks.id, f: 'pledge_name' }),
      ),
      Markup.button.callback(
        '✏️ Цена пледжа',
        router.encode(ksCallback, { a: 'ksEdit', id: ks.id, f: 'pledge_cost' }),
      ),
    ],
    [Markup.button.callback('« К карточке', router.encode(ksCallback, { a: 'ksView', id: ks.id }))],
  ]);
}

/**
 * The group-promo button: a deep link that opens the bot in DM on this
 * kickstarter's card («Провести ритуал» = buy it), since purchase (scrolls /
 * stars + file delivery) only works in private chat. No button without a known
 * bot username (e.g. before launch).
 */
export function kickstarterPromoKeyboard(
  kickstarterId: number,
  botUsername?: string,
): ReturnType<typeof Markup.inlineKeyboard> {
  if (!botUsername) return Markup.inlineKeyboard([]);
  return Markup.inlineKeyboard([
    [
      Markup.button.url(
        '🔮 Провести ритуал',
        `https://t.me/${botUsername}?start=ks_${kickstarterId}`,
      ),
    ],
  ]);
}

export { DEFAULT_SCROLL_ID };
