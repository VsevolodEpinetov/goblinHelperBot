const { Composer, Markup } = require("telegraf");
const util = require('../../../util');
const SETTINGS = require('../../../../settings.json');

module.exports = Composer.action(/^changeTicketsSpent_/g, async (ctx) => {
  const data = ctx.callbackQuery.data.split('_');
  const userId = data[1];
  ctx.userSession.userId = userId;

  await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
  
  ctx.scene.enter('ADMIN_SCENE_CHANGE_TICKETS_SPENT');
});