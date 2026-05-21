import { Markup } from 'telegraf';

import { router } from '../../core/router';

import type { ApplicationRow } from './repo';
import { onboardingAdminCallback, onboardingCallback } from './schemas';

export function startMenuForNewbie(): ReturnType<typeof Markup.inlineKeyboard> {
  return Markup.inlineKeyboard([
    [Markup.button.callback('Что это такое?', router.encode(onboardingCallback, { a: 'onAbout' }))],
    [
      Markup.button.callback(
        'Подать заявку',
        router.encode(onboardingCallback, { a: 'onApplyStart' }),
      ),
    ],
  ]);
}

export function aboutMenu(): ReturnType<typeof Markup.inlineKeyboard> {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        'Подать заявку',
        router.encode(onboardingCallback, { a: 'onApplyStart' }),
      ),
    ],
    [Markup.button.callback('« Назад', router.encode(onboardingCallback, { a: 'onCancel' }))],
  ]);
}

export function pendingMenu(): ReturnType<typeof Markup.inlineKeyboard> {
  return Markup.inlineKeyboard([]);
}

export function adminListItemButton(
  app: ApplicationRow,
): ReturnType<typeof Markup.button.callback> {
  const display = app.username
    ? `@${app.username}`
    : [app.firstName, app.lastName].filter(Boolean).join(' ') || `id:${app.userId}`;
  return Markup.button.callback(
    display,
    router.encode(onboardingAdminCallback, { a: 'onAdminView', id: app.id }),
  );
}

export function adminPagination(
  page: number,
  hasNext: boolean,
): ReturnType<typeof Markup.button.callback>[] {
  const buttons: ReturnType<typeof Markup.button.callback>[] = [];
  if (page > 0) {
    buttons.push(
      Markup.button.callback(
        '«',
        router.encode(onboardingAdminCallback, { a: 'onAdminList', page: page - 1 }),
      ),
    );
  }
  if (hasNext) {
    buttons.push(
      Markup.button.callback(
        '»',
        router.encode(onboardingAdminCallback, { a: 'onAdminList', page: page + 1 }),
      ),
    );
  }
  return buttons;
}

export function adminFilterRow(): ReturnType<typeof Markup.button.callback>[] {
  return [
    Markup.button.callback(
      '⏳ Pending',
      router.encode(onboardingAdminCallback, { a: 'onAdminFilter', status: 'pending', page: 0 }),
    ),
    Markup.button.callback(
      '✅ Approved',
      router.encode(onboardingAdminCallback, { a: 'onAdminFilter', status: 'approved', page: 0 }),
    ),
    Markup.button.callback(
      '🙅 Rejected',
      router.encode(onboardingAdminCallback, { a: 'onAdminFilter', status: 'rejected', page: 0 }),
    ),
  ];
}

export function adminViewKeyboard(
  app: ApplicationRow,
  page: number,
): ReturnType<typeof Markup.inlineKeyboard> {
  const rows: ReturnType<typeof Markup.button.callback>[][] = [];
  if (app.status === 'pending') {
    rows.push([
      Markup.button.callback(
        '✅ Approve',
        router.encode(onboardingAdminCallback, { a: 'onAdminApprove', id: app.id }),
      ),
      Markup.button.callback(
        '🙅 Reject',
        router.encode(onboardingAdminCallback, { a: 'onAdminReject', id: app.id }),
      ),
    ]);
  }
  rows.push([
    Markup.button.callback(
      '« Назад',
      router.encode(onboardingAdminCallback, { a: 'onAdminBack', page }),
    ),
  ]);
  return Markup.inlineKeyboard(rows);
}
