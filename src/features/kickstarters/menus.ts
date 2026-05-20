import { Markup } from 'telegraf';

import { router } from '../../core/router';

import type { KickstarterRow } from './repo';
import { ksCallback } from './schemas';

/** Pick a scroll the user wants to spend; assume one default scroll id "kickstarter" for v2. */
const DEFAULT_SCROLL_ID = 'kickstarter';

export function userViewKeyboard(
  ks: Pick<KickstarterRow, 'id'>,
  alreadyOwned: boolean,
): ReturnType<typeof Markup.inlineKeyboard> {
  if (alreadyOwned) {
    return Markup.inlineKeyboard([]);
  }
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        '🎟 Использовать свиток',
        router.encode(ksCallback, { a: 'ksBuyScroll', id: ks.id }),
      ),
    ],
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
  ]);
}

export { DEFAULT_SCROLL_ID };
