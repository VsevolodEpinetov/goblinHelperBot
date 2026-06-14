import type { Context, Telegraf } from 'telegraf';

import { logger } from '../../../core/observability';
import { requireRoles } from '../../../core/permissions';
import { router } from '../../../core/router';
import { db } from '../../../db/client';
import { getRolesForUser } from '../../../db/repos/user-roles';
import { adminViewKeyboard } from '../menus';
import {
  countApplications,
  getApplicationById,
  listApplications,
  type ApplicationStatus,
} from '../repo';
import { onboardingAdminCallback } from '../schemas';
import { approve, reject } from '../service';

import { adminHubKeyboard, listScreen, PAGE_SIZE, userCard } from './menus';

const ADMIN_ROLES = ['admin', 'adminPlus', 'super'] as const;

/** Render the application list at the given page + status filter, in place. */
async function showList(ctx: Context, page: number, status: ApplicationStatus): Promise<void> {
  const apps = await listApplications(db, { status, limit: PAGE_SIZE, offset: page * PAGE_SIZE });
  const total = await countApplications(db, { status });
  const { text, keyboard } = listScreen(apps, page, total, status);
  await ctx.editMessageText(text, { parse_mode: 'HTML', ...keyboard });
}

/**
 * After approve/reject: when the verdict came from the list view (page+status
 * threaded), re-render the list so the admin keeps working the queue. When it
 * came from the push notification (no context), append the verdict + acting
 * admin to the card so the совет chat keeps who-decided-what history.
 */
async function afterVerdict(
  ctx: Context,
  payload: { page?: number; status?: ApplicationStatus },
  verdictText: string,
): Promise<void> {
  if (payload.status !== undefined) {
    await showList(ctx, payload.page ?? 0, payload.status);
    return;
  }
  const msg =
    ctx.callbackQuery && 'message' in ctx.callbackQuery ? ctx.callbackQuery.message : undefined;
  const original = msg && 'text' in msg ? msg.text : '';
  const actor = ctx.from?.username
    ? `@${ctx.from.username}`
    : [ctx.from?.first_name, ctx.from?.last_name].filter(Boolean).join(' ') || `id:${ctx.from?.id}`;
  const verdictLine = `${verdictText} — ${actor}`;
  await ctx.editMessageText(original ? `${original}\n\n${verdictLine}` : verdictLine);
}

export function registerOnboardingAdmin(bot: Telegraf): void {
  bot.command('applications', requireRoles(...ADMIN_ROLES), async (ctx) => {
    const page = 0;
    const apps = await listApplications(db, {
      status: 'pending',
      limit: PAGE_SIZE,
      offset: 0,
    });
    const total = await countApplications(db, { status: 'pending' });
    const { text, keyboard } = listScreen(apps, page, total);
    await ctx.reply(text, { parse_mode: 'HTML', ...keyboard });
  });

  router.on(onboardingAdminCallback, async (ctx, payload) => {
    if (!ctx.from) {
      await ctx.answerCbQuery?.();
      return;
    }
    const roles = ctx.state.roles ?? [];
    if (!ADMIN_ROLES.some((r) => roles.includes(r))) {
      await ctx.answerCbQuery?.('Не твоя печать, чужак.');
      return;
    }

    try {
      switch (payload.a) {
        case 'onAdminHub': {
          await ctx.editMessageText(
            '⚔️ Зал совета открыт, старейшина. Командуй — всё хозяйство логова по кнопкам ниже.',
            { ...adminHubKeyboard() },
          );
          await ctx.answerCbQuery?.();
          break;
        }
        case 'onAdminList':
        case 'onAdminBack': {
          await showList(ctx, payload.page, payload.status ?? 'pending');
          await ctx.answerCbQuery?.();
          break;
        }
        case 'onAdminFilter': {
          await showList(ctx, payload.page, payload.status);
          await ctx.answerCbQuery?.();
          break;
        }
        case 'onAdminView': {
          const app = await getApplicationById(db, payload.id);
          if (!app) {
            await ctx.answerCbQuery?.('Прошение не найдено');
            break;
          }
          const userRoles = await getRolesForUser(db, app.userId);
          await ctx.editMessageText(userCard(app, userRoles), {
            parse_mode: 'HTML',
            ...adminViewKeyboard(app, payload.page ?? 0, payload.status ?? 'pending'),
          });
          await ctx.answerCbQuery?.();
          break;
        }
        case 'onAdminApprove': {
          const result = await approve(payload.id, ctx.from.id);
          if (result === 'approved') {
            await ctx.answerCbQuery?.('Впущен');
            await afterVerdict(ctx, payload, '✅ Впущен в логово');
          } else if (result === 'not_found') {
            await ctx.answerCbQuery?.('Прошение не найдено');
          } else {
            await ctx.answerCbQuery?.('Уже решено');
          }
          break;
        }
        case 'onAdminReject': {
          const result = await reject(payload.id, ctx.from.id);
          if (result === 'rejected') {
            await ctx.answerCbQuery?.('Отвергнут');
            await afterVerdict(ctx, payload, '🙅 Отвергнут советом');
          } else if (result === 'not_found') {
            await ctx.answerCbQuery?.('Прошение не найдено');
          } else {
            await ctx.answerCbQuery?.('Уже решено');
          }
          break;
        }
      }
    } catch (err) {
      // Re-tapping the already-active filter re-renders identical content; Telegram
      // rejects that with "message is not modified" — a harmless no-op, not a failure.
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('message is not modified')) {
        await ctx.answerCbQuery?.();
        return;
      }
      logger.error({ err, payload }, 'onboarding admin route failed');
      await ctx.answerCbQuery?.('Сорвалось, повтори');
    }
  });
}
