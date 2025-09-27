const { Composer, Markup } = require('telegraf');

module.exports = Composer.action('adminMonths', async (ctx) => {
  try {
    await ctx.answerCbQuery('🧪 Simple test works!');
    
    await ctx.editMessageText('🧪 <b>Simple Test Action Works!</b>\n\nAdmin action system is functional.\n\nThe issue is in the original admin action code.', {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Назад', 'userMenu')]
      ])
    });
    
  } catch (error) {
    console.error('🧪 SIMPLE TEST: Error:', error);
  }
});
