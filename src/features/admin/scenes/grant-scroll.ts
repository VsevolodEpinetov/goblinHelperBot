import { Scenes } from 'telegraf';

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
  await ctx.reply('Формат: `<scrollId> <amount>` (например `kickstarter 1`). Или /cancel.', {
    parse_mode: 'Markdown',
  });
});

grantScrollScene.command('cancel', async (ctx) => {
  ctx.scene.state = {};
  await ctx.scene.leave();
  await ctx.reply('Отменено.');
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
  const newBalance = await adminGrantScroll(state.userId, scrollId!, amount);
  await ctx.reply(`✅ Новое количество свитка "${scrollId}": ${newBalance}`);
  ctx.scene.state = {};
  await ctx.scene.leave();
});
