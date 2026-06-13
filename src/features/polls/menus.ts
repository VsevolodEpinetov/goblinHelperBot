import { Markup } from 'telegraf';

import { router } from '../../core/router';

import { pollsCallback } from './schemas';

export function adminMenu(): ReturnType<typeof Markup.inlineKeyboard> {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('Основной список', router.encode(pollsCallback, { a: 'polCoreList' })),
      Markup.button.callback(
        '🔥 Сбросить основной',
        router.encode(pollsCallback, { a: 'polCoreReset' }),
      ),
    ],
    [
      Markup.button.callback(
        'Динамический список',
        router.encode(pollsCallback, { a: 'polDynList' }),
      ),
      Markup.button.callback(
        '🔥 Сбросить динамический',
        router.encode(pollsCallback, { a: 'polDynReset' }),
      ),
    ],
  ]);
}

/** A back-to-menu row for list/result screens so they aren't dead-ends. */
export function pollsMenuRow(): ReturnType<typeof Markup.button.callback>[] {
  return [Markup.button.callback('« Меню', router.encode(pollsCallback, { a: 'polMenu' }))];
}

/** Two-step confirm before a destructive reset. */
export function pollsResetConfirm(
  target: 'core' | 'dynamic',
): ReturnType<typeof Markup.inlineKeyboard> {
  const yes = target === 'core' ? 'polCoreResetYes' : 'polDynResetYes';
  return Markup.inlineKeyboard([
    [Markup.button.callback('✅ Да, очистить', router.encode(pollsCallback, { a: yes }))],
    [Markup.button.callback('« Отмена', router.encode(pollsCallback, { a: 'polMenu' }))],
  ]);
}
