const { Composer, Markup } = require('telegraf');

module.exports = Composer.action('adminStarsBalance', async (ctx) => {
  console.log('🧪 TEST: adminStarsBalance action triggered!');
  
  try {
    await ctx.answerCbQuery('🧪 Test action works!');
    console.log('🧪 TEST: answerCbQuery successful');
    
    await ctx.editMessageText('🧪 <b>Test Action Works!</b>\n\nStar balance action is working correctly.', {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Назад', 'adminMenu')]
      ])
    });
    
    console.log('🧪 TEST: editMessageText successful');
    
  } catch (error) {
    console.error('🧪 TEST: Error in test action:', error);
  }
});
