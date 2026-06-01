import type { Telegraf } from 'telegraf';

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

import { listScreen, PAGE_SIZE, userCard } from './menus';

const ADMIN_ROLES = ['admin', 'adminPlus', 'super'] as const;

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
      await ctx.answerCbQuery?.('Не твоя печать, чужак');
      return;
    }

    try {
      switch (payload.a) {
        case 'onAdminList':
        case 'onAdminBack': {
          const page = payload.page;
          const apps = await listApplications(db, {
            status: 'pending',
            limit: PAGE_SIZE,
            offset: page * PAGE_SIZE,
          });
          const total = await countApplications(db, { status: 'pending' });
          const { text, keyboard } = listScreen(apps, page, total);
          await ctx.editMessageText(text, { parse_mode: 'HTML', ...keyboard });
          await ctx.answerCbQuery?.();
          break;
        }
        case 'onAdminFilter': {
          const status: ApplicationStatus = payload.status;
          const page = payload.page;
          const apps = await listApplications(db, {
            status,
            limit: PAGE_SIZE,
            offset: page * PAGE_SIZE,
          });
          const total = await countApplications(db, { status });
          const { text, keyboard } = listScreen(apps, page, total);
          await ctx.editMessageText(text, { parse_mode: 'HTML', ...keyboard });
          await ctx.answerCbQuery?.();
          break;
        }
        case 'onAdminView': {
          const app = await getApplicationById(db, payload.id);
          if (!app) {
            await ctx.answerCbQuery?.('Свиток не найден');
            break;
          }
          const userRoles = await getRolesForUser(db, app.userId);
          await ctx.editMessageText(userCard(app, userRoles), {
            parse_mode: 'HTML',
            ...adminViewKeyboard(app, 0),
          });
          await ctx.answerCbQuery?.();
          break;
        }
        case 'onAdminApprove': {
          const result = await approve(payload.id, ctx.from.id);
          if (result === 'approved') {
            await ctx.answerCbQuery?.('Впущен');
            await ctx.editMessageText('✅ Впущен в логово.');
          } else if (result === 'not_found') {
            await ctx.answerCbQuery?.('Свиток не найден');
          } else {
            await ctx.answerCbQuery?.('Уже решено');
          }
          break;
        }
        case 'onAdminReject': {
          const result = await reject(payload.id, ctx.from.id);
          if (result === 'rejected') {
            await ctx.answerCbQuery?.('Отвергнут');
            await ctx.editMessageText('🙅 Отвергнут советом.');
          } else if (result === 'not_found') {
            await ctx.answerCbQuery?.('Свиток не найден');
          } else {
            await ctx.answerCbQuery?.('Уже решено');
          }
          break;
        }
      }
    } catch (err) {
      logger.error({ err, payload }, 'onboarding admin route failed');
      await ctx.answerCbQuery?.('Сорвалось, повтори');
    }
  });
}
