const { Composer, Markup } = require("telegraf");
const { getUser } = require('../../db/helpers');
const { t } = require('../../i18n');

module.exports = Composer.action('detailedHelp', async (ctx) => {
  try { await ctx.answerCbQuery(); } catch {}
  
  try {
    const userData = await getUser(ctx.from.id);
    if (!userData) {
      await ctx.editMessageText(t('messages.user_not_found'), { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback(t('help.back'), 'refreshUserStatus')]]) });
      return;
    }

    const detailedHelpMessage = t('help.detailed');

    const helpKeyboard = [
      [Markup.button.callback('🔙 К краткой справке', 'userHelp')],
      [Markup.button.callback(t('help.back'), 'refreshUserStatus')]
    ];

    await ctx.editMessageText(detailedHelpMessage, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard(helpKeyboard)
    });
    
  } catch (error) {
    console.error('Error in detailedHelp:', error);
    await ctx.editMessageText(t('messages.try_again_later'), { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback(t('help.back'), 'refreshUserStatus')]]) });
  }
});
