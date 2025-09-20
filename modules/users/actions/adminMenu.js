const { Composer, Markup } = require("telegraf");
const { getSuperUserMenu } = require('../menus/superUserMenu');

module.exports = Composer.action('adminMenu', async (ctx) => {
  try { await ctx.answerCbQuery(); } catch {}
  
  try {
    const menu = getSuperUserMenu(ctx, {});
    await ctx.editMessageText(menu.message, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard(menu.keyboard)
    });
    
  } catch (error) {
    console.error('Error in adminMenu:', error);
    await ctx.editMessageText(
      require('../../../modules/i18n').t('messages.try_again_later'),
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback(require('../../../modules/i18n').t('messages.back'), 'refreshUserStatus')]
        ])
      }
    );
  }
});
