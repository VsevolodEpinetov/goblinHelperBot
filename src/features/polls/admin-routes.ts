import { Markup } from 'telegraf';
import type { Telegraf } from 'telegraf';

import { answerThenEdit } from '../../core/nav';
import { logger } from '../../core/observability';
import { requireRoles } from '../../core/permissions';
import { router } from '../../core/router';
import { db } from '../../db/client';

import { POLLS_ROLES } from './constants';
import { adminMenu, pollsMenuRow, pollsResetConfirm } from './menus';
import { listCoreStudios, listDynamicStudios, resetCoreStudios, resetDynamicStudios } from './repo';
import { pollsCallback } from './schemas';

export function registerAdminRoutes(bot: Telegraf): void {
  bot.command('polls', requireRoles(...POLLS_ROLES), async (ctx) => {
    await ctx.reply('⚖️ Опросы. Чего прикажешь, старейшина?', adminMenu());
  });

  router.on(pollsCallback, async (ctx, payload) => {
    const roles = ctx.state.roles ?? [];
    if (!POLLS_ROLES.some((r) => roles.includes(r))) {
      await ctx.answerCbQuery?.('Недостаточно прав');
      return;
    }

    try {
      switch (payload.a) {
        case 'polMenu': {
          await answerThenEdit(ctx, '⚖️ Опросы. Чего прикажешь, старейшина?', adminMenu());
          break;
        }
        case 'polCoreList': {
          const rows = await listCoreStudios(db);
          const body =
            rows.length === 0
              ? 'Основной список пуст — ни одной студии.'
              : rows.map((r) => `• ${r.name}`).join('\n');
          await answerThenEdit(ctx, body, Markup.inlineKeyboard([pollsMenuRow()]));
          break;
        }
        case 'polDynList': {
          const rows = await listDynamicStudios(db);
          const body =
            rows.length === 0
              ? 'Динамический список пуст — ни одной студии.'
              : rows.map((r) => `• ${r.name}`).join('\n');
          await answerThenEdit(ctx, body, Markup.inlineKeyboard([pollsMenuRow()]));
          break;
        }
        case 'polCoreReset': {
          await answerThenEdit(
            ctx,
            '⚖️ Точно очистить основной список студий? Назад не вернёшь.',
            pollsResetConfirm('core'),
          );
          break;
        }
        case 'polDynReset': {
          await answerThenEdit(
            ctx,
            '⚖️ Точно очистить динамический список студий? Назад не вернёшь.',
            pollsResetConfirm('dynamic'),
          );
          break;
        }
        case 'polCoreResetYes': {
          const n = await resetCoreStudios(db);
          await answerThenEdit(
            ctx,
            `Сделано, старейшина. Основной список очищен (строк: ${n}).`,
            Markup.inlineKeyboard([pollsMenuRow()]),
          );
          break;
        }
        case 'polDynResetYes': {
          const n = await resetDynamicStudios(db);
          await answerThenEdit(
            ctx,
            `Сделано, старейшина. Динамический список очищен (строк: ${n}).`,
            Markup.inlineKeyboard([pollsMenuRow()]),
          );
          break;
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('message is not modified')) {
        await ctx.answerCbQuery?.();
        return;
      }
      logger.error({ err, payload }, 'polls admin route failed');
      try {
        await ctx.answerCbQuery?.('Сорвалось, повтори');
      } catch {
        /* already answered */
      }
    }
  });
}
