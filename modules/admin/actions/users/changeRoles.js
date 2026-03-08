const { Composer, Markup } = require("telegraf");
const util = require('../../../util');
const SETTINGS = require('../../../../settings.json');
const { ensureRoles } = require('../../../rbac');

const SUPER_ROLES = ['super'];

module.exports = Composer.action(/^changeUserRoles_/g, async (ctx) => {
  const check = await ensureRoles(ctx, SUPER_ROLES);
  if (!check.allowed) return;

  ctx.userSession.userId = ctx.callbackQuery.data.split('_')[1];
  try {
    await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
  } catch (e) {
    await ctx.replyWithHTML(`Из-за ограничений телеграма тебе нужно использовать /start ещё раз. Старое сообщение останется, можешь его удалить вручную, если мешает.`)
    return;
  }
  ctx.scene.enter('ADMIN_SCENE_CHANGE_USER_ROLES');
});