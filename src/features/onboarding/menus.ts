import { Markup } from 'telegraf';

import { router } from '../../core/router';
import { invitationsCallback } from '../invitations/schemas';
import { isKsDelegate } from '../kickstarters/constants';
import { ksCallback } from '../kickstarters/schemas';
import { loyaltyCallback } from '../loyalty/schemas';
import { isPollsDelegate } from '../polls/constants';
import { pollsCallback } from '../polls/schemas';
import { promoCallback } from '../promo/schemas';
import { raidsCallback } from '../raids/schemas';
import { subscriptionsCallback } from '../subscriptions/schemas';

import type { ApplicationRow, ApplicationStatus } from './repo';
import { onboardingAdminCallback, onboardingCallback } from './schemas';

export function startMenuForNewbie(): ReturnType<typeof Markup.inlineKeyboard> {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        '🌑 Что это за место',
        router.encode(onboardingCallback, { a: 'onAbout' }),
      ),
    ],
    [
      Markup.button.callback(
        '🔐 Пройти обряд допуска',
        router.encode(onboardingCallback, { a: 'onApplyStart' }),
      ),
    ],
  ]);
}

export function aboutMenu(): ReturnType<typeof Markup.inlineKeyboard> {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        '🔐 Пройти обряд допуска',
        router.encode(onboardingCallback, { a: 'onApplyStart' }),
      ),
    ],
    [Markup.button.callback('« Назад', router.encode(onboardingCallback, { a: 'onCancel' }))],
  ]);
}

/** Shown under «your application is with the council» screens: one button to
 * re-check whether the verdict has come, so the wait is never a dead end. */
export function pendingStatusKeyboard(): ReturnType<typeof Markup.inlineKeyboard> {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        '🔄 Узнать вердикт',
        router.encode(onboardingCallback, { a: 'onStatus' }),
      ),
    ],
  ]);
}

export function adminListItemButton(
  app: ApplicationRow,
  page: number,
  status: ApplicationStatus,
): ReturnType<typeof Markup.button.callback> {
  const display = app.username
    ? `@${app.username}`
    : [app.firstName, app.lastName].filter(Boolean).join(' ') || `id:${app.userId}`;
  return Markup.button.callback(
    display,
    router.encode(onboardingAdminCallback, { a: 'onAdminView', id: app.id, page, status }),
  );
}

export function adminPagination(
  page: number,
  hasNext: boolean,
  status: ApplicationStatus,
): ReturnType<typeof Markup.button.callback>[] {
  const buttons: ReturnType<typeof Markup.button.callback>[] = [];
  if (page > 0) {
    buttons.push(
      Markup.button.callback(
        '«',
        router.encode(onboardingAdminCallback, { a: 'onAdminList', page: page - 1, status }),
      ),
    );
  }
  if (hasNext) {
    buttons.push(
      Markup.button.callback(
        '»',
        router.encode(onboardingAdminCallback, { a: 'onAdminList', page: page + 1, status }),
      ),
    );
  }
  return buttons;
}

export function adminFilterRow(): ReturnType<typeof Markup.button.callback>[] {
  return [
    Markup.button.callback(
      '⏳ На рассмотрении',
      router.encode(onboardingAdminCallback, { a: 'onAdminFilter', status: 'pending', page: 0 }),
    ),
    Markup.button.callback(
      '✅ Впущенные',
      router.encode(onboardingAdminCallback, { a: 'onAdminFilter', status: 'approved', page: 0 }),
    ),
    Markup.button.callback(
      '🙅 Отвергнутые',
      router.encode(onboardingAdminCallback, { a: 'onAdminFilter', status: 'rejected', page: 0 }),
    ),
  ];
}

export function adminViewKeyboard(
  app: ApplicationRow,
  page: number,
  listStatus: ApplicationStatus,
): ReturnType<typeof Markup.inlineKeyboard> {
  const rows: ReturnType<typeof Markup.button.callback>[][] = [];
  if (app.status === 'pending') {
    rows.push([
      Markup.button.callback(
        '✅ Впустить',
        router.encode(onboardingAdminCallback, {
          a: 'onAdminApprove',
          id: app.id,
          page,
          status: listStatus,
        }),
      ),
      Markup.button.callback(
        '🙅 Отвергнуть',
        router.encode(onboardingAdminCallback, {
          a: 'onAdminReject',
          id: app.id,
          page,
          status: listStatus,
        }),
      ),
    ]);
  }
  rows.push([
    Markup.button.callback(
      '« Назад',
      router.encode(onboardingAdminCallback, { a: 'onAdminBack', page, status: listStatus }),
    ),
  ]);
  return Markup.inlineKeyboard(rows);
}

/** Inline [Впустить] [Отвергнуть] row for the new-application notification. */
export function verdictKeyboard(appId: number): ReturnType<typeof Markup.inlineKeyboard> {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        '✅ Впустить',
        router.encode(onboardingAdminCallback, { a: 'onAdminApprove', id: appId }),
      ),
      Markup.button.callback(
        '🙅 Отвергнуть',
        router.encode(onboardingAdminCallback, { a: 'onAdminReject', id: appId }),
      ),
    ],
  ]);
}

function memberHubRows(
  roles: readonly string[] = [],
): ReturnType<typeof Markup.button.callback>[][] {
  const rows: ReturnType<typeof Markup.button.callback>[][] = [
    [
      Markup.button.callback(
        '🪙 Месячный архив',
        router.encode(subscriptionsCallback, { a: 'subOpen' }),
      ),
    ],
    [
      Markup.button.callback('👤 Профиль', router.encode(loyaltyCallback, { a: 'profile' })),
      Markup.button.callback(
        '🏆 Лучшие в логове',
        router.encode(loyaltyCallback, { a: 'leaders' }),
      ),
    ],
    [
      Markup.button.callback('🎯 Кикстартеры', router.encode(ksCallback, { a: 'ksList' })),
      Markup.button.callback('⚔️ Рейды', router.encode(raidsCallback, { a: 'raidList' })),
    ],
    [
      Markup.button.callback(
        '🚪 Войти в архивы',
        router.encode(invitationsCallback, { a: 'inviteMenu' }),
      ),
      Markup.button.callback('🎁 Гостинец', router.encode(promoCallback, { a: 'promoGet' })),
    ],
  ];
  // A poll-delegate goblin (polls/adminPolls, not full admin) reaches the polls
  // menu only here — they never see the «Админка» hub where its button lives.
  if (isPollsDelegate(roles)) {
    rows.push([
      Markup.button.callback('📊 Опросы', router.encode(pollsCallback, { a: 'polMenu' })),
    ]);
  }
  // A kickstarter delegate (adminKs, not full admin) creates/edits from here —
  // the admin-hub «🚀 Новый кикстартер» button is staff-only.
  if (isKsDelegate(roles)) {
    rows.push([
      Markup.button.callback('🚀 Новый кикстартер', router.encode(ksCallback, { a: 'ksAdd' })),
    ]);
  }
  return rows;
}

/** The approved-member home hub shown on /start. Each button opens a feature
 * screen via that feature's callback (which self-authorizes the caller). */
export function memberHubKeyboard(
  roles: readonly string[] = [],
): ReturnType<typeof Markup.inlineKeyboard> {
  return Markup.inlineKeyboard(memberHubRows(roles));
}

/** Admin /start: the member hub plus a row into the /admin hub. */
export function adminStartKeyboard(): ReturnType<typeof Markup.inlineKeyboard> {
  return Markup.inlineKeyboard([
    ...memberHubRows(),
    [
      Markup.button.callback(
        '🛠 Админка',
        router.encode(onboardingAdminCallback, { a: 'onAdminHub' }),
      ),
    ],
  ]);
}

/** A «back to the member hub» button, reused by every feature screen so members
 * can always return home without typing /start. */
export function homeButton(): ReturnType<typeof Markup.button.callback> {
  return Markup.button.callback('« В логово', router.encode(onboardingCallback, { a: 'onHome' }));
}

/** A standalone row holding just the home button. */
export function homeRow(): ReturnType<typeof Markup.button.callback>[] {
  return [homeButton()];
}
