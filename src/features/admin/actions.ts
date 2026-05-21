import type { Scenes } from 'telegraf';

import { logger } from '../../core/observability';
import { router } from '../../core/router';
import { db } from '../../db/client';
import { isStaff } from '../../shared/user-status';

import { monthsKeyboard, userCard } from './menus';
import { listMonths } from './repo';
import { ADD_MONTH_SCENE_ID } from './scenes/add-month';
import { CHANGE_BALANCE_SCENE_ID } from './scenes/change-balance';
import { GRANT_ROLE_SCENE_ID } from './scenes/grant-role';
import { GRANT_SCROLL_SCENE_ID } from './scenes/grant-scroll';
import { SET_MONTH_CHAT_SCENE_ID } from './scenes/set-month-chat';
import { adminCallback } from './schemas';
import { adminGrantAchievement, getUserOverview } from './service';

export function registerAdminActions(): void {
  router.on(adminCallback, async (ctx, payload) => {
    const roles = ctx.state.roles ?? [];
    if (!isStaff(roles)) {
      await ctx.answerCbQuery?.('Нет прав');
      return;
    }

    try {
      switch (payload.a) {
        case 'adUser': {
          const overview = await getUserOverview(payload.id);
          const { text, keyboard } = userCard(overview, `id:${payload.id}`);
          await ctx.editMessageText(text, { parse_mode: 'HTML', ...keyboard });
          await ctx.answerCbQuery?.();
          break;
        }
        case 'adGrantRole':
          await ctx.answerCbQuery?.();
          await (ctx as unknown as Scenes.SceneContext).scene.enter(GRANT_ROLE_SCENE_ID, {
            userId: payload.id,
            mode: 'add',
          });
          break;
        case 'adRemoveRole':
          await ctx.answerCbQuery?.();
          await (ctx as unknown as Scenes.SceneContext).scene.enter(GRANT_ROLE_SCENE_ID, {
            userId: payload.id,
            mode: 'remove',
          });
          break;
        case 'adGrantScroll':
          await ctx.answerCbQuery?.();
          await (ctx as unknown as Scenes.SceneContext).scene.enter(GRANT_SCROLL_SCENE_ID, {
            userId: payload.id,
          });
          break;
        case 'adChangeBalance':
          await ctx.answerCbQuery?.();
          await (ctx as unknown as Scenes.SceneContext).scene.enter(CHANGE_BALANCE_SCENE_ID, {
            userId: payload.id,
          });
          break;
        case 'adGrantAch': {
          const result = await adminGrantAchievement(payload.id, payload.key);
          await ctx.answerCbQuery?.(
            result.alreadyHad ? 'Уже было' : result.applied ? '✅ Выдано' : 'Не выдано',
          );
          break;
        }
        case 'adMonths': {
          const months = await listMonths(db);
          const { text, keyboard } = monthsKeyboard(months);
          await ctx.editMessageText(text, { ...keyboard });
          await ctx.answerCbQuery?.();
          break;
        }
        case 'adAddMonth':
          await ctx.answerCbQuery?.();
          await (ctx as unknown as Scenes.SceneContext).scene.enter(ADD_MONTH_SCENE_ID, {});
          break;
        case 'adSetMonthChat':
          await ctx.answerCbQuery?.();
          await (ctx as unknown as Scenes.SceneContext).scene.enter(SET_MONTH_CHAT_SCENE_ID, {
            period: payload.period,
            tier: payload.tier,
          });
          break;
      }
    } catch (err) {
      logger.error({ err, payload }, 'admin action failed');
      await ctx.answerCbQuery?.('Ошибка');
    }
  });
}
