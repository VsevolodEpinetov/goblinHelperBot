import { Scenes } from 'telegraf';

import { adminSetBalance, parseBalanceInput } from '../service';

interface State {
  userId?: number;
}

export const CHANGE_BALANCE_SCENE_ID = 'admin:change-balance';
export const changeBalanceScene = new Scenes.BaseScene<Scenes.SceneContext>(
  CHANGE_BALANCE_SCENE_ID,
);

changeBalanceScene.enter(async (ctx) => {
  const state = ctx.scene.state as State;
  if (!state.userId) {
    await ctx.scene.leave();
    return;
  }
  await ctx.reply('Введи новое значение баланса (целое число). Или /cancel.');
});

changeBalanceScene.command('cancel', async (ctx) => {
  ctx.scene.state = {};
  await ctx.scene.leave();
  await ctx.reply('Отменено.');
});

changeBalanceScene.on('text', async (ctx) => {
  const state = ctx.scene.state as State;
  if (!state.userId) {
    await ctx.scene.leave();
    return;
  }
  try {
    const balance = parseBalanceInput(ctx.message.text);
    await adminSetBalance(state.userId, balance);
    await ctx.reply(`✅ Баланс установлен: ${balance}`);
  } catch (err) {
    await ctx.reply((err as Error).message);
    return;
  }
  ctx.scene.state = {};
  await ctx.scene.leave();
});
