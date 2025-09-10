const { Composer, Markup } = require('telegraf');

module.exports = Composer.action('adminStarsBalance', async (ctx) => {
  try {
    await ctx.answerCbQuery('🧪 Test action works!');
    
    await ctx.editMessageText('🧪 <b>Test Action Works!</b>\n\nStar balance action is working correctly.', {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Назад', 'adminMenu')]
      ])
    });
    
  } catch (error) {
    console.error('🧪 TEST: Error in test action:', error);
  }
});
