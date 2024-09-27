const { Composer, Markup } = require("telegraf");
const util = require('../../../util');
const SETTINGS = require('../../../../settings.json');

module.exports = Composer.action(/^adminAddLinkPlus_/g, async (ctx) => {
  ctx.session.year = ctx.callbackQuery.data.split('_')[1];
  ctx.session.month = ctx.callbackQuery.data.split('_')[2];
  await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
  ctx.scene.enter('ADMIN_SCENE_ADD_LINK_PLUS');
});