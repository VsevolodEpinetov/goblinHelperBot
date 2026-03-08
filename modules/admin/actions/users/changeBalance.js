const { Composer, Markup } = require("telegraf");
const util = require('../../../util');
const SETTINGS = require('../../../../settings.json');
const { ensureRoles } = require('../../../rbac');

const SUPER_ROLES = ['super'];

module.exports = Composer.action(/^changeBalance_/g, async (ctx) => {
  const check = await ensureRoles(ctx, SUPER_ROLES);
  if (!check.allowed) return;

  const data = ctx.callbackQuery.data.split('_');
  const userId = data[1];
  ctx.userSession.userId = userId;

  try {
    await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
  } catch (e) {
    await ctx.replyWithHTML(`Из-за ограничений телеграма тебе нужно использовать /start ещё раз. Старое сообщение останется, можешь его удалить вручную, если мешает.`)
    return;
  }
  
  ctx.scene.enter('ADMIN_SCENE_CHANGE_BALANCE');
});