const { Composer, Markup } = require("telegraf");

module.exports = Composer.action('deleteThisMessage', async (ctx) => {
  await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
});