import { Markup } from 'telegraf';

import { router } from '../../core/router';

import type { GroupType } from './repo';
import { invitationsCallback } from './schemas';

export function getLinkButton(
  year: number,
  month: number,
  tier: GroupType,
): ReturnType<typeof Markup.button.callback> {
  return Markup.button.callback(
    '🎫 Получить ссылку',
    router.encode(invitationsCallback, { a: 'inviteGet', year, month, tier }),
  );
}

export function getLinkInline(
  year: number,
  month: number,
  tier: GroupType,
): ReturnType<typeof Markup.inlineKeyboard> {
  return Markup.inlineKeyboard([[getLinkButton(year, month, tier)]]);
}
