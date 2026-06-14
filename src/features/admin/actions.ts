import { Markup } from 'telegraf';
import type { Scenes } from 'telegraf';

import { featureConfig, featureReport } from '../../core/config';
import { formatHealthChecks, runConfigHealthChecks } from '../../core/health';
import { logger } from '../../core/observability';
import { router } from '../../core/router';
import { db } from '../../db/client';
import { ACHIEVEMENTS, isKnownAchievement } from '../../shared/achievements';
import { escapeHtml } from '../../shared/format';
import { isStaff } from '../../shared/user-status';
import { KS_ADD_CHAIN } from '../kickstarters/scenes/add-chain';
import { homeRow } from '../onboarding/menus';

import { backToHubKeyboard, monthsKeyboard, userCard, userMonthsScreen } from './menus';
import { listMonths } from './repo';
import { ADD_MONTH_SCENE_ID } from './scenes/add-month';
import { CHANGE_BALANCE_SCENE_ID } from './scenes/change-balance';
import { FIND_USER_SCENE_ID } from './scenes/find-user';
import { GRANT_MONTH_SCENE_ID } from './scenes/grant-month';
import { GRANT_ROLE_SCENE_ID } from './scenes/grant-role';
import { GRANT_SCROLL_SCENE_ID } from './scenes/grant-scroll';
import { SET_MONTH_CHAT_SCENE_ID } from './scenes/set-month-chat';
import { adminCallback } from './schemas';
import {
  adminGrantAchievement,
  adminGrantRole,
  adminRemoveRole,
  adminRevokeMonth,
  bindArchiveChat,
  getUserOverview,
  listUserMonths,
  tierWord,
} from './service';

export function registerAdminActions(): void {
  router.on(adminCallback, async (ctx, payload) => {
    const roles = ctx.state.roles ?? [];
    if (!isStaff(roles)) {
      await ctx.answerCbQuery?.('Не дозволено');
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
            result.alreadyHad ? 'Уже было!' : result.applied ? '✅ Выдано' : '⛔️ Не выдано',
          );
          // Tell the member — achievements change their prices, they must know.
          if (result.applied && isKnownAchievement(payload.key)) {
            try {
              await ctx.telegram.sendMessage(
                payload.id,
                `🏅 Совет отметил тебя: заслуга <b>${ACHIEVEMENTS[payload.key].displayName}</b> теперь твоя. Носи с гордостью — такое в логове не каждому достаётся.`,
                { parse_mode: 'HTML', ...Markup.inlineKeyboard([homeRow()]) },
              );
            } catch (dmErr) {
              logger.warn({ dmErr, userId: payload.id }, 'adGrantAch: member DM failed');
            }
          }
          break;
        }
        case 'adUMon': {
          const months = await listUserMonths(payload.id);
          const { text, keyboard } = userMonthsScreen(payload.id, months);
          await ctx.editMessageText(text, { parse_mode: 'HTML', ...keyboard });
          await ctx.answerCbQuery?.();
          break;
        }
        case 'adGMon': {
          await ctx.answerCbQuery?.();
          const tiers: ('regular' | 'plus')[] =
            payload.t === 'both' ? ['regular', 'plus'] : [payload.t];
          await (ctx as unknown as Scenes.SceneContext).scene.enter(GRANT_MONTH_SCENE_ID, {
            userId: payload.id,
            tiers,
          });
          break;
        }
        case 'adRMon': {
          const removed = await adminRevokeMonth(payload.id, payload.period, payload.tier);
          await ctx.answerCbQuery?.(
            removed
              ? '⚔️ Месяц отнят. Гоблин его больше не нащупает.'
              : '🌑 Нечего отнимать — такого месяца у гоблина и не водилось.',
          );
          const months = await listUserMonths(payload.id);
          const { text, keyboard } = userMonthsScreen(payload.id, months);
          await ctx.editMessageText(text, { parse_mode: 'HTML', ...keyboard });
          break;
        }
        case 'adFriend': {
          if (!ctx.from) {
            await ctx.answerCbQuery?.();
            break;
          }
          const actor = { id: ctx.from.id, roles };
          try {
            if (payload.on) await adminGrantRole(actor, payload.id, 'friend');
            else await adminRemoveRole(actor, payload.id, 'friend');
          } catch (e) {
            // Moderation guard (e.g. friending a fellow admin) — surface the reason.
            await ctx.answerCbQuery?.((e as Error).message, { show_alert: true });
            break;
          }
          await ctx.answerCbQuery?.(payload.on ? '🤝 Теперь гоблин — друг логова' : '📉 Дружба кончилась');
          // Welcome the new friend by DM (grant only) — they should know access opened.
          if (payload.on) {
            try {
              await ctx.telegram.sendMessage(
                payload.id,
                'Уже было!',
                { parse_mode: 'HTML', ...Markup.inlineKeyboard([homeRow()]) },
              );
            } catch (dmErr) {
              logger.warn({ dmErr, userId: payload.id }, 'adFriend: welcome DM failed');
            }
          }
          // Re-render the card so the toggle button flips to its new state.
          const overview = await getUserOverview(payload.id);
          const { text, keyboard } = userCard(overview, `id:${payload.id}`);
          await ctx.editMessageText(text, { parse_mode: 'HTML', ...keyboard });
          break;
        }
        case 'bindHere': {
          // Tapped inside the archive itself — bind THIS chat to the period/tier.
          if (!ctx.chat) {
            await ctx.answerCbQuery?.();
            break;
          }
          const { movedFrom } = await bindArchiveChat(
            payload.period,
            payload.tier,
            String(ctx.chat.id),
          );
          await ctx.answerCbQuery?.('🔥 Готово');
          let text = `🔥 Готово. Этот чат высечен на камне как <b>${tierWord(payload.tier)}</b> архив за <b>${escapeHtml(payload.period)}</b> — дверь сторожу, ключи выкую и в продажу пущу.`;
          if (movedFrom) {
            text += `\n👁‍🗨 Старую метку стёр — был <b>${tierWord(movedFrom.tier as 'regular' | 'plus')}</b> архивом за <b>${escapeHtml(movedFrom.period)}</b>, теперь служит новому.`;
          }
          await ctx.editMessageText(text, { parse_mode: 'HTML' });
          break;
        }
        case 'bindCancel':
          await ctx.answerCbQuery?.();
          await ctx.editMessageText('🌑 Брось. Ничего не отметил, чат такой как и был ранее.');
          break;
        case 'adMonths': {
          const months = await listMonths(db);
          const { text, keyboard } = monthsKeyboard(months, payload.page ?? 0);
          await ctx.editMessageText(text, { ...keyboard });
          await ctx.answerCbQuery?.();
          break;
        }
        case 'adAddMonth':
          await ctx.answerCbQuery?.();
          await (ctx as unknown as Scenes.SceneContext).scene.enter(ADD_MONTH_SCENE_ID, {});
          break;
        case 'adFind':
          await ctx.answerCbQuery?.();
          await (ctx as unknown as Scenes.SceneContext).scene.enter(FIND_USER_SCENE_ID, {});
          break;
        case 'adKsAdd':
          await ctx.answerCbQuery?.();
          await (ctx as unknown as Scenes.SceneContext).scene.enter(KS_ADD_CHAIN.steps[0]!, {});
          break;
        case 'adHealth': {
          // Live probe + the static feature report — the same diagnostics the
          // boot logs print, but on demand and inside Telegram.
          await ctx.answerCbQuery?.();
          const fc = featureConfig();
          const botId = ctx.botInfo?.id;
          const lines = ['🩺 Обошёл логово, проверил все ходы и связь с советом. Докладываю:', ''];
          if (botId) {
            const checks = await runConfigHealthChecks(ctx.telegram, fc, botId);
            lines.push(...formatHealthChecks(checks), '');
          }
          lines.push(...featureReport(fc).map((l) => `· ${l}`));
          await ctx.editMessageText(lines.join('\n'), { ...backToHubKeyboard() });
          break;
        }
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
      await ctx.answerCbQuery?.('🪛 Ошибка');
    }
  });
}
