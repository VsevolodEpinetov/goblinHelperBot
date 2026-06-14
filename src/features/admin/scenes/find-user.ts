import { Scenes } from 'telegraf';

import { db } from '../../../db/client';
import { backToHubKeyboard, userListKeyboard } from '../menus';
import { searchUsers } from '../repo';
import { parseUserQuery } from '../service';

export const FIND_USER_SCENE_ID = 'admin:find-user';
export const findUserScene = new Scenes.BaseScene<Scenes.SceneContext>(FIND_USER_SCENE_ID);

findUserScene.enter(async (ctx) => {
  await ctx.reply('🔍 Кого найти? Дай id или @username. Отмена — /cancel.');
});

findUserScene.command('cancel', async (ctx) => {
  ctx.scene.state = {};
  await ctx.scene.leave();
  await ctx.reply('🕯 Отменил, как и приказал.', backToHubKeyboard());
});

findUserScene.on('text', async (ctx) => {
  try {
    const q = parseUserQuery(ctx.message.text);
    const rows = await searchUsers(db, q, 20);
    if (rows.length === 0) {
      await ctx.reply('👁‍🗨 Такого в наших книгах нет. Попробуй иначе — или /cancel.');
      return;
    }
    await ctx.reply(`🔍 Нашёл таких: ${rows.length}`, userListKeyboard(rows));
  } catch (err) {
    await ctx.reply((err as Error).message);
    return;
  }
  ctx.scene.state = {};
  await ctx.scene.leave();
});
