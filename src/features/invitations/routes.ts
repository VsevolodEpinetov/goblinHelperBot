import { Markup } from 'telegraf';
import type { Context, Telegraf } from 'telegraf';

import { editOrReply } from '../../core/nav';
import { requireApprovedMember } from '../../core/permissions';
import { router } from '../../core/router';
import { db } from '../../db/client';
import { getRolesForUser } from '../../db/repos/user-roles';
import { hasAllArchiveAccess } from '../../shared/user-status';
import { homeButton } from '../onboarding/menus';
import { listAllArchives, listUserSubscriptions } from '../subscriptions/repo';
import { subscriptionsCallback } from '../subscriptions/schemas';

import { joinLinkKeyboard } from './menus';

/**
 * The archives a user can mint a key for: every bound archive for friends and
 * staff (comped / by-office, no payment record), otherwise just the periods
 * they've paid for. Shared by renderJoinLink and the pagination callback so
 * both pages stay consistent.
 */
export async function accessiblePeriods(
  userId: number,
  roles: readonly string[],
): Promise<Array<{ period: string; tier: 'regular' | 'plus' }>> {
  return hasAllArchiveAccess(roles) ? listAllArchives(db) : listUserSubscriptions(db, userId);
}

/**
 * Show the member their accessible periods as buttons; tapping one mints/returns
 * its invite link. Shared by the /joinlink command and the 🚪 Ключ от ворот hub
 * button so members never need to type the command.
 */
export async function renderJoinLink(ctx: Context): Promise<void> {
  if (!ctx.from) return;
  const roles = ctx.state.roles ?? (await getRolesForUser(db, ctx.from.id));
  const subs = await accessiblePeriods(ctx.from.id, roles);
  if (subs.length === 0) {
    // Friends/staff with all-access but no archives exist yet vs a regular
    // member who simply hasn't paid — different nudge.
    if (hasAllArchiveAccess(roles)) {
      await editOrReply(
        ctx,
        '📦 Архивов в логове пока нет — заглядывай позже, открою все двери разом.',
        Markup.inlineKeyboard([[homeButton()]]),
      );
      return;
    }
    await editOrReply(
      ctx,
      '🌑 Оплаченных месяцев за тобой нет — и вход давать не во что. Возьми архив, тогда и поговорим.',
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            '🪙 Взять архив',
            router.encode(subscriptionsCallback, { a: 'subOpen' }),
          ),
        ],
        [homeButton()],
      ]),
    );
    return;
  }
  await editOrReply(
    ctx,
    '🚪 За какой месяц дверь отпереть? Выбери и я вынесу ключ.',
    joinLinkKeyboard(subs),
  );
}

export function registerInvitationCommands(bot: Telegraf): void {
  bot.command('joinlink', requireApprovedMember(), (ctx) => renderJoinLink(ctx));
}
