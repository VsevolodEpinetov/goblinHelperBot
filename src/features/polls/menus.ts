import { Markup } from 'telegraf';

import { router } from '../../core/router';

import { pollsCallback } from './schemas';

export function adminMenu(): ReturnType<typeof Markup.inlineKeyboard> {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('Core list', router.encode(pollsCallback, { a: 'polCoreList' })),
      Markup.button.callback('Reset core', router.encode(pollsCallback, { a: 'polCoreReset' })),
    ],
    [
      Markup.button.callback('Dynamic list', router.encode(pollsCallback, { a: 'polDynList' })),
      Markup.button.callback('Reset dynamic', router.encode(pollsCallback, { a: 'polDynReset' })),
    ],
  ]);
}
