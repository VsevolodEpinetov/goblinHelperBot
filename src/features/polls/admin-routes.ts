import { Markup } from 'telegraf';
import type { Telegraf } from 'telegraf';

import { featureConfig } from '../../core/config';
import { answerThenEdit } from '../../core/nav';
import { logger } from '../../core/observability';
import { requireRoles } from '../../core/permissions';
import { router } from '../../core/router';
import { db } from '../../db/client';

import { POLLS_ROLES } from './constants';
import { adminMenu, pollsLaunchConfirm, pollsMenuRow, pollsResetConfirm } from './menus';
import {
  getAllStudios,
  listCoreStudios,
  listDynamicStudios,
  resetCoreStudios,
  resetDynamicStudios,
} from './repo';
import { pollsCallback } from './schemas';
import { buildPollChunks } from './service';

const NO_GROUP_MSG =
  '🕯 Общего чата нет на примете, старейшина — <code>MAIN_GROUP_ID</code> не прописан. Некуда слать опросы. Настрой логово, тогда и запущу.';
const EMPTY_LISTS_MSG =
  '🌑 Оба списка пусты, старейшина — ни одной студии. Выносить на голосование нечего.';

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
        case 'polLaunch': {
          const fc = featureConfig();
          if (!fc.mainGroupId) {
            await answerThenEdit(ctx, NO_GROUP_MSG, {
              parse_mode: 'HTML',
              ...Markup.inlineKeyboard([pollsMenuRow()]),
            });
            break;
          }
          const studios = await getAllStudios(db);
          if (studios.length === 0) {
            await answerThenEdit(ctx, EMPTY_LISTS_MSG, Markup.inlineKeyboard([pollsMenuRow()]));
            break;
          }
          const chunks = buildPollChunks(studios);
          await answerThenEdit(
            ctx,
            `⚖️ Студий на голосование — <b>${studios.length}</b>. Разобью их на <b>${chunks.length}</b> опрос(ов) и разошлю в общий чат, старейшина. Слово скажешь — и обряд пошёл.`,
            { parse_mode: 'HTML', ...pollsLaunchConfirm() },
          );
          break;
        }
        case 'polLaunchYes': {
          const fc = featureConfig();
          if (!fc.mainGroupId) {
            await answerThenEdit(ctx, NO_GROUP_MSG, {
              parse_mode: 'HTML',
              ...Markup.inlineKeyboard([pollsMenuRow()]),
            });
            break;
          }
          const studios = await getAllStudios(db);
          if (studios.length === 0) {
            await answerThenEdit(ctx, EMPTY_LISTS_MSG, Markup.inlineKeyboard([pollsMenuRow()]));
            break;
          }
          const chunks = buildPollChunks(studios);
          for (let i = 0; i < chunks.length; i++) {
            await ctx.telegram.sendPoll(fc.mainGroupId, `Голосование. Часть ${i + 1}`, chunks[i]!, {
              is_anonymous: false,
              allows_multiple_answers: true,
              message_thread_id: fc.pollsTopicId,
            });
          }
          await answerThenEdit(
            ctx,
            `🔥 Сделано, старейшина. В общий чат ушло <b>${chunks.length}</b> опрос(ов) — пусть голосуют.`,
            { parse_mode: 'HTML', ...Markup.inlineKeyboard([pollsMenuRow()]) },
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
