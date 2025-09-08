const { Composer, Markup } = require("telegraf");

module.exports = Composer.action('userKickstarters', async (ctx) => {
  try { await ctx.answerCbQuery(); } catch {}
  
  try {
    const message = `🚀 <b>Кикстартеры</b>\n\n` +
                   `Здесь ты можешь участвовать в кикстартерах и получать эксклюзивные модели.\n\n` +
                   `Функционал кикстартеров будет добавлен в ближайшее время.\n\n` +
                   `Следи за обновлениями!`;
    
    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback(require('../../../modules/i18n').t('messages.back'), 'refreshUserStatus')]
      ])
    });
    
  } catch (error) {
    console.error('Error in userKickstarters:', error);
    await ctx.editMessageText(require('../../../modules/i18n').t('messages.try_again_later'), { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback(require('../../../modules/i18n').t('messages.back'), 'refreshUserStatus')]]) });
  }
});
