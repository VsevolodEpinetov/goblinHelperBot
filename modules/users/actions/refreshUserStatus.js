const { Composer } = require("telegraf");
const util = require('../../util');
const { getUser } = require('../../db/helpers');

module.exports = Composer.action('refreshUserStatus', async (ctx) => {
  const userData = await getUser(ctx.callbackQuery.from.id);
  if (!userData) return;

  if (userData.roles.indexOf('goblin') > -1) {
    // Refresh the menu with updated data
    const interactiveMenu = util.createInteractiveMenu(ctx, userData);
    
    await ctx.editMessageText(interactiveMenu.message, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard(interactiveMenu.keyboard)
    });
    
    // Show confirmation
    await ctx.answerCbQuery('✅ Статус обновлен!');
  }
});
