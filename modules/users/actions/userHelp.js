const { Composer, Markup } = require("telegraf");
const { getUser } = require('../../db/helpers');
const { t } = require('../../../modules/i18n');

module.exports = Composer.action('userHelp', async (ctx) => {
  try { await ctx.answerCbQuery(); } catch {}
  
  try {
    const userData = await getUser(ctx.from.id);
    if (!userData) {
      await ctx.editMessageText(t('messages.user_not_found'), { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback(t('help.back'), 'refreshUserStatus')]]) });
      return;
    }

    const helpMessage = t('help.basic');

    const helpKeyboard = [
      [Markup.button.callback('📚 Подробная справка', 'detailedHelp')],
      [Markup.button.callback(t('help.back'), 'refreshUserStatus')]
    ];

    await ctx.editMessageText(helpMessage, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard(helpKeyboard)
    });
    
  } catch (error) {
    console.error('Error in userHelp:', error);
    await ctx.editMessageText(t('messages.try_again_later'), { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback(t('help.back'), 'refreshUserStatus')]]) });
  }
});
