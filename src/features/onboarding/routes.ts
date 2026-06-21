import type { Context, Scenes, Telegraf } from 'telegraf';

import { editOrReply } from '../../core/nav';
import { ensureApprovedMember } from '../../core/permissions';
import { router } from '../../core/router';
import { db } from '../../db/client';
import { getRolesForUser } from '../../db/repos/user-roles';
import { currentPeriod, formatPeriod } from '../../shared/period';
import { getStatusDisplay, isApprovedMember } from '../../shared/user-status';
import { renderKickstarterCard } from '../kickstarters/actions';
import { renderRaidCard } from '../raids/actions';

import {
  aboutMenu,
  adminStartKeyboard,
  memberHubKeyboard,
  pendingStatusKeyboard,
  startMenuForNewbie,
} from './menus';
import { ONBOARDING_SCENE_ID } from './scene';
import { onboardingCallback } from './schemas';

const ABOUT_TEXT = `📜 Это логово Главгоблина — закрытое ложе, где из луны в луну копятся сокровища. На полке всегда новый <b>месячный архив</b>, а следит за этим библиотекарь — молча, но строго без допуска чужаков.

Сперва обряд допуска: совет читает твоё прошение и выносит вердикт. Одобрят — платишь звёзды в казну логова и забираешь <b>месячный архив</b>. Не одобрят — ступай своей дорогой путник.`;

const PENDING_TEXT =
  '⏳ Прошение твоё уже наверху, у совета. Старейшины шепчутся. Жди вердикта и не пинай меня меня по чем зря — решат, я тебе сам принесу весть.';

/**
 * Render the правильный /start screen for the user's current standing. Used by
 * the /start command (replies) and the onStatus refresh button (edits in place
 * via editOrReply).
 */
async function renderStartByStatus(ctx: Context, roles: readonly string[]): Promise<void> {
  if (!ctx.from) return;
  const status = getStatusDisplay(roles);

  switch (status.code) {
    case 'preapproved':
    case 'alumni': {
      const period = formatPeriod(currentPeriod());
      const paid = !!(await db('user_groups').where({ user_id: ctx.from.id, period }).first());
      await editOrReply(
        ctx,
        paid
          ? '🔥 С возвращением, гоблин! Месячный архив за этот цикл луны уже твой — всё открыто. Выбирай кнопкой ниже: архив, профиль, кикстартеры или рейды.'
          : '🪙 Ты свой гоблин и в логово пущен. Только свежий месячный архив ещё не доступен — казна логова пополнения от тебя не видела. Жми кнопку ниже, бери архив. Профиль, кикстартеры и рейды — там же.',
        memberHubKeyboard(roles),
      );
      return;
    }
    case 'admin':
    case 'super':
      await editOrReply(
        ctx,
        '⚖️ Совет на пороге. Чего прикажешь, старейшина? Логово твоё — кнопки ниже, админка там же.',
        adminStartKeyboard(),
      );
      return;
    case 'friend':
      await editOrReply(
        ctx,
        '🤝 А, это ты — гость самого Главгоблина. Платить тебе не велено: все архивы и главный зал открыты задаром. Бери, что нужно, не стесняйся.',
        memberHubKeyboard(roles),
      );
      return;
    case 'pending':
      await editOrReply(ctx, PENDING_TEXT, pendingStatusKeyboard());
      return;
    case 'rejected':
      await editOrReply(
        ctx,
        '💀 Совет уже отворачивался от тебя однажды. Но решение не на камне высечено — хочешь, попробуй обряд снова. Дважды я объяснять не буду.',
        { ...startMenuForNewbie() },
      );
      return;
    case 'banned':
    case 'selfBanned':
      // No reply; the banned get silence.
      return;
    case 'newbie':
    default:
      await editOrReply(
        ctx,
        '🌑 Ты набрёл на логово Главгоблина.\nЗдесь под замком копятся STL-сокровища. Двери открываются лишь тем, кого впустил совет. Хочешь — расскажу, что это за место, или можешь сразу перейти к обряду допуска.',
        { ...startMenuForNewbie() },
      );
  }
}

/**
 * Deep-link payloads (t.me/<bot>?start=<payload>) — the bridge from group-chat
 * cards into the bot's menus. Member-only; unknown payloads fall back to the
 * regular /start screen. Returns true when the payload was handled.
 */
async function handleStartPayload(
  ctx: Context,
  payload: string,
  roles: readonly string[],
): Promise<boolean> {
  if (!isApprovedMember(roles)) return false;
  const raidMatch = /^raid_(\d+)$/.exec(payload);
  if (raidMatch) {
    await renderRaidCard(ctx, Number(raidMatch[1]));
    return true;
  }
  const ksMatch = /^ks_(\d+)$/.exec(payload);
  if (ksMatch) {
    await renderKickstarterCard(ctx, Number(ksMatch[1]));
    return true;
  }
  return false;
}

export function registerOnboardingCommands(bot: Telegraf): void {
  bot.command('start', async (ctx) => {
    if (!ctx.from) return;
    const roles = ctx.state.roles ?? (await getRolesForUser(db, ctx.from.id));

    const payload = ctx.message.text.split(/\s+/)[1];
    if (payload && (await handleStartPayload(ctx, payload, roles))) return;

    await renderStartByStatus(ctx, roles);
  });

  router.on(onboardingCallback, async (ctx, payload) => {
    if (!ctx.from) {
      await ctx.answerCbQuery?.();
      return;
    }
    switch (payload.a) {
      case 'onHome':
        // ensureApprovedMember answers the callback with a denial when it fails,
        // so just bail without answering again.
        if (!(await ensureApprovedMember(ctx))) break;
        await editOrReply(
          ctx,
          '🔥 С возвращением, гоблин. ',
          memberHubKeyboard(ctx.state.roles ?? []),
        );
        await ctx.answerCbQuery?.();
        break;
      case 'onStatus': {
        // The verdict may have landed since this message was sent — re-read the
        // roles and re-render. Still pending → just a toast, the screen is right.
        const roles = await getRolesForUser(db, ctx.from.id);
        if (getStatusDisplay(roles).code === 'pending') {
          await ctx.answerCbQuery?.('⏳ Старейшины всё ещё шепчутся — вердикта нет. Жди.');
          break;
        }
        await renderStartByStatus(ctx, roles);
        await ctx.answerCbQuery?.();
        break;
      }
      case 'onAbout':
        await ctx.editMessageText(ABOUT_TEXT, { parse_mode: 'HTML', ...aboutMenu() });
        await ctx.answerCbQuery?.();
        break;
      case 'onCancel':
        await ctx.editMessageText('🌑 Вернулись к началу. Выбирай тропу, чужак.', {
          ...startMenuForNewbie(),
        });
        await ctx.answerCbQuery?.();
        break;
      case 'onApplyStart':
        await ctx.answerCbQuery?.();
        if (!ctx.from.username) {
          await ctx.reply(
            '🔒 Главгоблин не имеет дел с безымянными. Поставь себе публичный <b>username</b> в настройках Telegram и жми «Пройти обряд допуска» снова.',
            { parse_mode: 'HTML', ...startMenuForNewbie() },
          );
          return;
        }
        await (ctx as unknown as Scenes.SceneContext).scene.enter(ONBOARDING_SCENE_ID);
        break;
    }
  });
}
