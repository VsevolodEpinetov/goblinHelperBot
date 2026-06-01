import type { Scenes, Telegraf } from 'telegraf';

import { router } from '../../core/router';
import { db } from '../../db/client';
import { getRolesForUser } from '../../db/repos/user-roles';
import { currentPeriod, formatPeriod } from '../../shared/period';
import { getStatusDisplay } from '../../shared/user-status';

import { aboutMenu, memberHubKeyboard, startMenuForNewbie } from './menus';
import { ONBOARDING_SCENE_ID } from './scene';
import { onboardingCallback } from './schemas';

const ABOUT_TEXT = `📜 Это логово Главгоблина — закрытый притон, где из месяца в месяц копятся сокровища. На полке всегда новый <b>месячный архив</b>, а сторожит их библиотекарь — молча, без записи и без входа чужакам.

Сперва обряд допуска: совет читает твой свиток и выносит вердикт. Одобрят — платишь звёзды из своей казны за <b>месячный архив</b>. Не одобрят — ступай своей тропой.`;

export function registerOnboardingCommands(bot: Telegraf): void {
  bot.command('start', async (ctx) => {
    if (!ctx.from) return;
    const roles = ctx.state.roles ?? (await getRolesForUser(db, ctx.from.id));
    const status = getStatusDisplay(roles);

    switch (status.code) {
      case 'preapproved':
      case 'alumni': {
        const period = formatPeriod(currentPeriod());
        const paid = !!(await db('user_groups').where({ user_id: ctx.from.id, period }).first());
        await ctx.reply(
          paid
            ? '🔥 С возвращением, свой. Архив за месяц уже твой — всё открыто. Выбирай кнопкой ниже: архив, профиль, кикстартеры или рейды.'
            : '🪙 Ты свой, в логово пущен. Но казна пока пуста с твоей стороны — месячный архив за этот месяц ещё не взят. Жми кнопку ниже, бери архив. Профиль, кикстартеры и рейды — там же.',
          memberHubKeyboard(),
        );
        return;
      }
      case 'admin':
      case 'super':
        await ctx.reply('⚖️ Совет на пороге. Чего велишь, старейшина?');
        return;
      case 'pending':
        await ctx.reply(
          '⏳ Твой свиток уже наверху, у совета. Старейшины взвешивают твоё имя. Жди вердикта и не пинай меня — решат, я тебе сам принесу весть.',
        );
        return;
      case 'rejected':
        await ctx.reply(
          '💀 Совет уже отворачивался от тебя однажды. Но камень не высечен — хочешь, попробуй обряд снова. Дважды я объяснять не буду.',
          { ...startMenuForNewbie() },
        );
        return;
      case 'banned':
      case 'selfBanned':
        // No reply; the banned get silence.
        return;
      case 'newbie':
      default:
        await ctx.reply(
          '🌑 Ты набрёл на логово Главгоблина.\nЗдесь под замком копятся STL-сокровища. Двери открываются лишь тем, кого впустил совет. Хочешь — расскажу, что это за место, или сразу пройди обряд допуска.',
          { ...startMenuForNewbie() },
        );
    }
  });

  router.on(onboardingCallback, async (ctx, payload) => {
    if (!ctx.from) {
      await ctx.answerCbQuery?.();
      return;
    }
    switch (payload.a) {
      case 'onAbout':
        await ctx.editMessageText(ABOUT_TEXT, { parse_mode: 'HTML', ...aboutMenu() });
        await ctx.answerCbQuery?.();
        break;
      case 'onCancel':
        await ctx.editMessageText('🌑 Вернулись к воротам. Выбирай тропу, чужак.', {
          ...startMenuForNewbie(),
        });
        await ctx.answerCbQuery?.();
        break;
      case 'onApplyStart':
        await ctx.answerCbQuery?.();
        if (!ctx.from.username) {
          await ctx.reply(
            '🔒 Главгоблин не торгует с безымянными. Поставь себе публичный <b>username</b> в настройках Telegram и возвращайся к обряду.',
            { parse_mode: 'HTML' },
          );
          return;
        }
        await (ctx as unknown as Scenes.SceneContext).scene.enter(ONBOARDING_SCENE_ID);
        break;
    }
  });
}
