const { Composer, Markup } = require("telegraf");
const { getUser } = require('../../db/helpers');
const { getUserMenu } = require('../menuSystem');

module.exports = Composer.action('adminMenu', async (ctx) => {
  try { await ctx.answerCbQuery(); } catch {}
  
  try {
    const userData = await getUser(ctx.callbackQuery.from.id);
    if (!userData) {
      await ctx.editMessageText('❌ <b>Пользователь не найден</b>', {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Назад', 'refreshUserStatus')]])
      });
      return;
    }
    
    // Get the appropriate menu for the user (will show admin menu if they have admin roles)
    const menu = await getUserMenu(ctx, userData);
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
