import { Markup } from 'telegraf';

import { router } from '../../core/router';
import { homeButton } from '../onboarding/menus';
import { subscriptionsCallback } from '../subscriptions/schemas';

import { formatKickstarterShort } from './format';
import type { KickstarterRow } from './repo';
import { ksCallback } from './schemas';

/** Pick a scroll the user wants to spend; assume one default scroll id "kickstarter" for v2. */
const DEFAULT_SCROLL_ID = 'kickstarter';

export const KS_PAGE_SIZE = 8;

type KsListItem = Pick<KickstarterRow, 'id' | 'name' | 'cost'>;

/** Prev/Next nav row for a paginated kickstarter list (carries the catalogue's
 * unowned-only filter so paging keeps it). */
function ksPaginationRow(
  action: 'ksList' | 'ksMine',
  page: number,
  hasNext: boolean,
  unowned = false,
): ReturnType<typeof Markup.button.callback>[] {
  const link = (p: number): string =>
    action === 'ksList'
      ? router.encode(ksCallback, { a: 'ksList', p, ...(unowned ? { u: true } : {}) })
      : router.encode(ksCallback, { a: 'ksMine', p });
  const buttons: ReturnType<typeof Markup.button.callback>[] = [];
  if (page > 0) buttons.push(Markup.button.callback('«', link(page - 1)));
  if (hasNext) buttons.push(Markup.button.callback('Ещё »', link(page + 1)));
  return buttons;
}

/** One tappable button per kickstarter (✅-marked when already owned). `page`
 * rides into the card so its «back» returns to the same catalogue page. */
function ksItemRows(
  rows: readonly KsListItem[],
  ownedIds: ReadonlySet<number>,
  page = 0,
): ReturnType<typeof Markup.button.callback>[][] {
  return rows.map((ks) => [
    Markup.button.callback(
      `${ownedIds.has(ks.id) ? '✅ ' : ''}${formatKickstarterShort(ks)}`,
      router.encode(ksCallback, { a: 'ksView', id: ks.id, ...(page > 0 ? { p: page } : {}) }),
    ),
  ]);
}

/** Catalogue: a page of kickstarters + prev/next, search, my-list, home. */
export function catalogKeyboard(
  rows: readonly KsListItem[],
  ownedIds: ReadonlySet<number> = new Set(),
  page = 0,
  hasNext = false,
  unownedOnly = false,
): ReturnType<typeof Markup.inlineKeyboard> {
  const pagination = ksPaginationRow('ksList', page, hasNext, unownedOnly);
  const filterButton = unownedOnly
    ? Markup.button.callback('👁 Показать все', router.encode(ksCallback, { a: 'ksList', p: 0 }))
    : Markup.button.callback(
        '🙈 Скрыть купленные',
        router.encode(ksCallback, { a: 'ksList', p: 0, u: true }),
      );
  return Markup.inlineKeyboard([
    ...ksItemRows(rows, ownedIds, page),
    ...(pagination.length > 0 ? [pagination] : []),
    [
      Markup.button.callback('🔍 Поиск', router.encode(ksCallback, { a: 'ksSearch' })),
      Markup.button.callback('🎯 Мои кикстартеры', router.encode(ksCallback, { a: 'ksMine' })),
    ],
    [filterButton],
    [homeButton()],
  ]);
}

/** "My kickstarters": a page of owned items + prev/next, back-to-catalogue, home. */
export function myKickstartersKeyboard(
  rows: readonly KsListItem[],
  page = 0,
  hasNext = false,
): ReturnType<typeof Markup.inlineKeyboard> {
  const pagination = ksPaginationRow('ksMine', page, hasNext);
  return Markup.inlineKeyboard([
    ...ksItemRows(rows, new Set()),
    ...(pagination.length > 0 ? [pagination] : []),
    [Markup.button.callback('« К каталогу', router.encode(ksCallback, { a: 'ksList' }))],
    [homeButton()],
  ]);
}

/** Search results: matched kickstarters + back-to-catalogue, home. */
export function ksSearchResultsKeyboard(
  rows: readonly KsListItem[],
  ownedIds: ReadonlySet<number> = new Set(),
): ReturnType<typeof Markup.inlineKeyboard> {
  return Markup.inlineKeyboard([
    ...ksItemRows(rows, ownedIds),
    [Markup.button.callback('« К каталогу', router.encode(ksCallback, { a: 'ksList' }))],
    [homeButton()],
  ]);
}

export function userViewKeyboard(
  ks: Pick<KickstarterRow, 'id'>,
  alreadyOwned: boolean,
  staff = false,
  backPage = 0,
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
    Markup.button.callback(
      '« К каталогу',
      router.encode(ksCallback, { a: 'ksList', ...(backPage > 0 ? { p: backPage } : {}) }),
    ),
    homeButton(),
  ];
  if (alreadyOwned) {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback(
          '📥 Скачать снова',
          router.encode(ksCallback, { a: 'ksRedownload', id: ks.id }),
        ),
      ],
      ...adminRows,
      backRow,
    ]);
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
