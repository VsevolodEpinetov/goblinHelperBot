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
  const nav: ReturnType<typeof Markup.button.callback>[] = [];
  if (current > 0) {
    nav.push(
      Markup.button.callback(
        '«',
        router.encode(invitePageCallback, { a: 'invitePage', p: current - 1 }),
      ),
    );
  }
  if (start + JOIN_LINK_PAGE_SIZE < subs.length) {
    nav.push(
      Markup.button.callback(
        '»',
        router.encode(invitePageCallback, { a: 'invitePage', p: current + 1 }),
      ),
    );
  }
  const mainRow = [
    Markup.button.callback(
      '🏰 Войти в логово',
      router.encode(invitationsCallback, { a: 'inviteMain' }),
    ),
  ];
  return Markup.inlineKeyboard([mainRow, ...rows, ...(nav.length > 0 ? [nav] : []), homeRow()]);
}
