import { Scenes } from 'telegraf';

import { db } from '../../../db/client';
import { backToMonthsKeyboard } from '../menus';
import { updateMonthChatId } from '../repo';

interface State {
  period?: string;
  tier?: 'regular' | 'plus';
}

export const SET_MONTH_CHAT_SCENE_ID = 'admin:set-month-chat';
export const setMonthChatScene = new Scenes.BaseScene<Scenes.SceneContext>(SET_MONTH_CHAT_SCENE_ID);

setMonthChatScene.enter(async (ctx) => {
  const state = ctx.scene.state as State;
  if (!state.period || !state.tier) {
    await ctx.scene.leave();
    return;
  }
  await ctx.reply(
    `Перешли любое сообщение из группы для ${state.period}/${state.tier}. Или /cancel.`,
  );
});

setMonthChatScene.command('cancel', async (ctx) => {
  ctx.scene.state = {};
  await ctx.scene.leave();
  await ctx.reply('Отменено.', backToMonthsKeyboard());
});

setMonthChatScene.on('message', async (ctx) => {
  const state = ctx.scene.state as State;
  if (!state.period || !state.tier) {
    await ctx.scene.leave();
    return;
  }
  // Telegraf 4.x exposes the forwarded-from chat as `ctx.message.forward_origin` (or
  // `forward_from_chat` on older clients). Accept either.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m = ctx.message as any;
  const chatId = m.forward_from_chat?.id ?? m.forward_origin?.chat?.id;
  if (chatId === undefined) {
    await ctx.reply('Не вижу id чата. Перешли сообщение из самой группы.');
    return;
  }
  await updateMonthChatId(db, state.period, state.tier, String(chatId));
  await ctx.reply(
    `✅ chat_id для ${state.period}/${state.tier} установлен: ${chatId}`,
    backToMonthsKeyboard(),
  );
  ctx.scene.state = {};
  await ctx.scene.leave();
});
