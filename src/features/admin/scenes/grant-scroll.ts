import { Markup, Scenes } from 'telegraf';

import { logger } from '../../../core/observability';
import { escapeHtml } from '../../../shared/format';
import { homeRow } from '../../onboarding/menus';
import { KNOWN_SCROLL_IDS } from '../../scrolls/service';
import { backToUserKeyboard } from '../menus';
import { adminGrantScroll } from '../service';

interface State {
  userId?: number;
}

export const GRANT_SCROLL_SCENE_ID = 'admin:grant-scroll';
export const grantScrollScene = new Scenes.BaseScene<Scenes.SceneContext>(GRANT_SCROLL_SCENE_ID);

grantScrollScene.enter(async (ctx) => {
  const state = ctx.scene.state as State;
  if (!state.userId) {
    await ctx.scene.leave();
    return;
  }
  // HTML, not Markdown: an underscore in any scroll id would open an italic
  // entity legacy Markdown never closes and Telegram would reject the send.
  await ctx.reply(
    `📜 Какой свиток и сколько? Формат: <code>&lt;scrollId&gt; &lt;amount&gt;</code>, например <code>kickstarter 1</code>. В ходу: ${escapeHtml(
      KNOWN_SCROLL_IDS.join(', '),
    )}. Отмена — /cancel.`,
    { parse_mode: 'HTML' },
  );
});

grantScrollScene.command('cancel', async (ctx) => {
  const { userId } = ctx.scene.state as State;
  ctx.scene.state = {};
  await ctx.scene.leave();
  await ctx.reply('Отменено.', userId ? backToUserKeyboard(userId) : undefined);
});

grantScrollScene.on('text', async (ctx) => {
  const state = ctx.scene.state as State;
  if (!state.userId) {
    await ctx.scene.leave();
    return;
  }
  const parts = ctx.message.text.trim().split(/\s+/);
  if (parts.length !== 2) {
    await ctx.reply('Нужно: <scrollId> <amount>');
    return;
  }
  const [scrollId, amountRaw] = parts;
  const amount = Number(amountRaw);
  if (!Number.isInteger(amount) || amount <= 0) {
    await ctx.reply('amount должен быть положительным целым числом');
    return;
  }
  try {
    const newBalance = await adminGrantScroll(state.userId, scrollId!, amount);
    await ctx.reply(
      `✅ Новое количество свитка "${scrollId}": ${newBalance}`,
      backToUserKeyboard(state.userId),
    );
    // Tell the member about their windfall — scrolls are invisible otherwise.
    try {
      await ctx.telegram.sendMessage(
        state.userId,
        `📜 Совет отсыпал тебе свитков: +${amount}, всего в запасе ${newBalance}. Трать на кикстартеры — добыча сама себя не заберёт.`,
        Markup.inlineKeyboard([homeRow()]),
      );
    } catch (dmErr) {
      logger.warn({ dmErr, userId: state.userId }, 'grant-scroll: member DM failed');
    }
  } catch (err) {
    await ctx.reply((err as Error).message);
    return;
  }
  ctx.scene.state = {};
  await ctx.scene.leave();
});
