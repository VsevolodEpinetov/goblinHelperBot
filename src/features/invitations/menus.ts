import { Markup } from 'telegraf';
import { z } from 'zod';

import { router } from '../../core/router';
import { homeRow } from '../onboarding/menus';

import type { GroupType } from './repo';
import { invitationsCallback } from './schemas';

/** Page through paid periods a year at a time so the keyboard never outgrows Telegram's button limit. */
const JOIN_LINK_PAGE_SIZE = 12;

export const invitePageCallback = z.discriminatedUnion('a', [
  z.object({ a: z.literal('invitePage'), p: z.number().int().min(0) }),
]);

/** One «get link» button per paid period the member owns, plus a home row. */
export function joinLinkKeyboard(
  subs: ReadonlyArray<{ period: string; tier: GroupType }>,
  page = 0,
): ReturnType<typeof Markup.inlineKeyboard> {
  const maxPage = Math.max(0, Math.ceil(subs.length / JOIN_LINK_PAGE_SIZE) - 1);
  const current = Math.min(Math.max(page, 0), maxPage);
  const start = current * JOIN_LINK_PAGE_SIZE;
  const rows = subs.slice(start, start + JOIN_LINK_PAGE_SIZE).map((s) => {
    const [y, m] = s.period.split('_');
    const pretty = y && m ? `${m}.${y}` : s.period;
    const label = s.tier === 'plus' ? `🚪 ${pretty} 💎` : `🚪 ${pretty}`;
    return [
      Markup.button.callback(
        label,
        router.encode(invitationsCallback, {
          a: 'inviteGet',
          year: Number(y),
          month: Number(m),
          tier: s.tier,
        }),
      ),
    ];
  });
  // Newest periods sort first (repo orders by period desc), so page 0 is always
  // the freshest. The «стр. N/M» counter makes it obvious the list is paged —
  // tapping it just re-renders the current page (a harmless no-op).
  const totalPages = maxPage + 1;
  const nav: ReturnType<typeof Markup.button.callback>[] = [];
  if (totalPages > 1) {
    if (current > 0) {
      nav.push(
        Markup.button.callback(
          '«',
          router.encode(invitePageCallback, { a: 'invitePage', p: current - 1 }),
        ),
      );
    }
    nav.push(
      Markup.button.callback(
        `стр. ${current + 1}/${totalPages}`,
        router.encode(invitePageCallback, { a: 'invitePage', p: current }),
      ),
    );
    if (current < maxPage) {
      nav.push(
        Markup.button.callback(
          '»',
          router.encode(invitePageCallback, { a: 'invitePage', p: current + 1 }),
        ),
      );
    }
  }
  const mainRow = [
    Markup.button.callback(
      '🏰 Войти в логово',
      router.encode(invitationsCallback, { a: 'inviteMain' }),
    ),
  ];
  return Markup.inlineKeyboard([mainRow, ...rows, ...(nav.length > 0 ? [nav] : []), homeRow()]);
}
