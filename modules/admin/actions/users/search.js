const { Composer, Markup } = require("telegraf");

module.exports = Composer.action('searchUser', async (ctx) => {
  await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
  ctx.scene.enter('SCENE_SEARCH_USER');
});