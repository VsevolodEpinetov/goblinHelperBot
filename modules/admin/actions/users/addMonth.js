const { Composer, Markup } = require("telegraf");
const util = require('../../../util');
const SETTINGS = require('../../../../settings.json');

module.exports = Composer.action(/^addUserMonth_/g, async (ctx) => {
  ctx.userSession.userId = ctx.callbackQuery.data.split('_')[1];
  await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
  ctx.scene.enter('ADMIN_SCENE_ADD_USER_MONTH');
});