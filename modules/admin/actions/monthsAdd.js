const { Composer, Markup } = require("telegraf");
const util = require('../../util');
const SETTINGS = require('../../../settings.json');

module.exports = Composer.action(/^monthsAdd_/g, async (ctx) => {
  ctx.session.year = ctx.callbackQuery.data.split('_')[1];
  await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
  ctx.scene.enter('ADMIN_SCENE_ADD_MONTH');
});