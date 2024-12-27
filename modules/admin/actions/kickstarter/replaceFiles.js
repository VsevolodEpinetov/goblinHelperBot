const { Composer, Markup } = require("telegraf");
const util = require('../../../util');
const SETTINGS = require('../../../../settings.json');

module.exports = Composer.action(/^replaceFilesKickstarter_/g, async (ctx) => {
  try {
    await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
  } catch (e) {
    await ctx.replyWithHTML(`Из-за ограничений телеграма тебе нужно использовать /start ещё раз. Старое сообщение останется, можешь его удалить вручную, если мешает.`)
    return;
  }
  const ksId = ctx.callbackQuery.data.split('_')[1];
  ctx.session.editingKickstarter = {};
  ctx.session.editingKickstarter.id = ksId;
  ctx.session.editingKickstarter.files = [];
  ctx.scene.enter('ADMIN_SCENE_REPLACE_KICKSTARTER_FILES');
});