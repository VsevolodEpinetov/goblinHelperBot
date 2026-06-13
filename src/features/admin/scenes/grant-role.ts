import { Scenes } from 'telegraf';

import { logger } from '../../../core/observability';
import { backToUserKeyboard } from '../menus';
import { adminGrantRole, adminRemoveRole } from '../service';

interface State {
  userId?: number;
  mode?: 'add' | 'remove';
}

export const GRANT_ROLE_SCENE_ID = 'admin:grant-role';
export const grantRoleScene = new Scenes.BaseScene<Scenes.SceneContext>(GRANT_ROLE_SCENE_ID);

grantRoleScene.enter(async (ctx) => {
  const state = ctx.scene.state as State;
  if (!state.userId || !state.mode) {
    await ctx.scene.leave();
    return;
  }
  await ctx.reply(`Введи имя роли (${state.mode === 'add' ? 'добавить' : 'удалить'}) или /cancel.`);
});

grantRoleScene.command('cancel', async (ctx) => {
  const { userId } = ctx.scene.state as State;
  ctx.scene.state = {};
  await ctx.scene.leave();
  await ctx.reply('Отменено.', userId ? backToUserKeyboard(userId) : undefined);
});

grantRoleScene.on('text', async (ctx) => {
  const state = ctx.scene.state as State;
  if (!state.userId || !state.mode || !ctx.from) {
    await ctx.scene.leave();
    return;
  }
  const actor = { id: ctx.from.id, roles: (ctx.state.roles as string[] | undefined) ?? [] };
  const role = ctx.message.text.trim();
  try {
    const applied =
      state.mode === 'add'
        ? await adminGrantRole(actor, state.userId, role)
        : await adminRemoveRole(actor, state.userId, role);
    await ctx.reply(
      applied ? '✅ Готово' : 'Без изменений (роль уже была/отсутствовала)',
      backToUserKeyboard(state.userId),
    );
  } catch (err) {
    logger.warn({ err }, 'admin grant-role: failed');
    await ctx.reply((err as Error).message);
    return;
  }
  ctx.scene.state = {};
  await ctx.scene.leave();
});
