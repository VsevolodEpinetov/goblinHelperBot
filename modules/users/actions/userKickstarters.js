const { Composer, Markup } = require("telegraf");

module.exports = Composer.action('userKickstarters', async (ctx) => {
  try { await ctx.answerCbQuery(); } catch {}
  
  try {
    const message = `😈 <b>Сделки с демонами</b>\n\n` +
    `Осторожнее, гоблин. Демоны предлагают артефакты — редкие и манящие, но каждый контракт стоит звёзд и не прощает ошибок.\n\n` +
    `Выбирай с умом.`;
 
    
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
