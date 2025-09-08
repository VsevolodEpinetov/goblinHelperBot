const { Composer, Markup } = require("telegraf");
const { getUser } = require('../../db/helpers');
const { t } = require('../../../modules/i18n');

module.exports = Composer.action('userTickets', async (ctx) => {
  try { await ctx.answerCbQuery(); } catch {}
  
  const userId = ctx.from.id;
  
  try {
    const userData = await getUser(userId);
    
    if (!userData) {
      await ctx.editMessageText(t('messages.user_not_found'), { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback(t('messages.back'), 'refreshUserStatus')]]) });
      return;
    }
    
    // Placeholder: current bot has no stars balance; show info to be implemented
    let message = `🎫 <b>Мои билеты</b>\n\n`;
    message += `Система билетов будет активирована позже.\n`;
    
    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([[Markup.button.callback(t('messages.back'), 'refreshUserStatus')]])
    });
    
  } catch (error) {
    console.error('Error in userTickets:', error);
    await ctx.editMessageText(t('messages.try_again_later'), { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback(t('messages.back'), 'refreshUserStatus')]]) });
  }
});
