import { Markup, Scenes } from 'telegraf';

import { logger } from '../../../core/observability';
import { formatPeriod } from '../../../shared/period';
import { service as invitationsService } from '../../invitations/service';
import { homeRow } from '../../onboarding/menus';
import { backToUserMonthsKeyboard } from '../menus';
import { adminGrantMonth, parsePeriodKey, tierWord } from '../service';

type Tier = 'regular' | 'plus';

interface State {
  userId?: number;
  tiers?: Tier[];
}

export const GRANT_MONTH_SCENE_ID = 'admin:grant-month';
export const grantMonthScene = new Scenes.BaseScene<Scenes.SceneContext>(GRANT_MONTH_SCENE_ID);

grantMonthScene.enter(async (ctx) => {
  const { userId, tiers } = ctx.scene.state as State;
  if (!userId || !tiers?.length) {
    await ctx.scene.leave();
    return;
  }
  await ctx.reply(
    '⚔️ Готов вписать месяц. Кинь мне период в виде <code>YYYY_MM</code> — к примеру <code>2026_06</code>. Тариф ты уже выбрал, осталась дата. Передумал — шепни /cancel.',
    { parse_mode: 'HTML' },
  );
});

grantMonthScene.command('cancel', async (ctx) => {
  const { userId } = ctx.scene.state as State;
  ctx.scene.state = {};
  await ctx.scene.leave();
  await ctx.reply('Отменено.', userId ? backToUserMonthsKeyboard(userId) : undefined);
});

grantMonthScene.on('text', async (ctx) => {
  const { userId, tiers } = ctx.scene.state as State;
  if (!userId || !tiers?.length) {
    await ctx.scene.leave();
    return;
  }

  let period: string;
  try {
    const { year, month } = parsePeriodKey(ctx.message.text);
    period = formatPeriod({ year, month });
  } catch {
    await ctx.reply('📅 Не разобрал период. Жду формат YYYY_MM, напр. 2026_06. Или /cancel.');
    return;
  }

  const newlyGranted: Tier[] = [];
  const alreadyHad: Tier[] = [];
  for (const tier of tiers) {
    const granted = await adminGrantMonth(userId, period, tier);
    (granted ? newlyGranted : alreadyHad).push(tier);
  }

  // Mint a join key for each freshly-granted tier that has a bound archive chat.
  const keyLines: string[] = [];
  const noChat: Tier[] = [];
  for (const tier of newlyGranted) {
    try {
      const link = await invitationsService.getOrCreateInvitationLink({ userId, period, type: tier });
      if (link.status === 'no_chat') noChat.push(tier);
      else keyLines.push(`${tier === 'plus' ? '💎' : '🪙'} ${tierWord(tier)}: ${link.link}`);
    } catch (err) {
      logger.error({ err, userId, period, tier }, 'grant-month: invite link failed');
      noChat.push(tier);
    }
  }

  // DM the goblin the freshly-minted keys (M1).
  let dmFailed = false;
  if (keyLines.length > 0) {
    try {
      await ctx.telegram.sendMessage(
        userId,
        `🔥 Слушай сюда. Совет пожаловал тебе архив — добыча твоя. Вот ключи, хватай и не теряй:\n${keyLines.join('\n')}`,
        {
          link_preview_options: { is_disabled: true },
          ...Markup.inlineKeyboard([homeRow()]),
        },
      );
    } catch (err) {
      dmFailed = true;
      logger.warn({ err, userId }, 'grant-month: member DM failed');
    }
  }

  const what = (t: Tier): string => `${period} — ${tierWord(t)}`;
  const keyedNow = newlyGranted.filter((t) => !noChat.includes(t));
  const lines: string[] = [];
  if (keyedNow.length > 0) {
    lines.push(
      dmFailed
        ? `🔥 Месяц ${keyedNow.map(what).join(', ')} вписан гоблину. 💀 А ключ доставить не вышло — гоблин личку запер или бота не будил. Скажи ему открыться, тогда ключ дойдёт.`
        : `🔥 Сделано. Месяц ${keyedNow.map(what).join(', ')} вписан гоблину, ключ улетел ему в личку. Дальше его забота.`,
    );
  }
  if (noChat.length > 0) {
    lines.push(
      `🕯 Месяц ${noChat.map(what).join(', ')} вписал, но к этому периоду архивный чат ещё не привязан — ключ слать некуда. Привяжешь чат — тогда и пустишь.`,
    );
  }
  if (alreadyHad.length > 0) {
    lines.push(`👁‍🗨 Этот месяц ${alreadyHad.map(what).join(', ')} у гоблина и так был. Ничего не трогал.`);
  }

  ctx.scene.state = {};
  await ctx.scene.leave();
  await ctx.reply(lines.join('\n\n'), backToUserMonthsKeyboard(userId));
});
