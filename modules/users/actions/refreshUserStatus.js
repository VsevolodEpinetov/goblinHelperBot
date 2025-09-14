const { Composer, Markup } = require("telegraf");
const { getUser } = require('../../db/helpers');
const { getUserMenu } = require('../menuSystem');

module.exports = Composer.action('refreshUserStatus', async (ctx) => {
  try { await ctx.answerCbQuery('✅ Статус обновлён!'); } catch {}
  
  try {
    const userData = await getUser(ctx.from.id);
    
    if (!userData) { 
      await ctx.editMessageText('❌ <b>Лицо не найдено в хрониках</b>\n\nТвои данные исчезли в тумане. Попробуй снова позже.', { 
        parse_mode: 'HTML', 
        ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Назад', 'refreshUserStatus')]]) 
      }); 
      return; 
    }

    // Get the appropriate menu for the user
    const menu = await getUserMenu(ctx, userData);
    
    // Try to edit the message, but handle "same content" error gracefully
    try {
      await ctx.editMessageText(menu.message, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard(menu.keyboard)
      });
    } catch (editError) {
      if (editError.message.includes('message is not modified')) {
        await ctx.answerCbQuery('✅ Статус актуален!');
      } else {
        // Re-throw if it's a different error
        throw editError;
      }
    }
    
  } catch (error) {
    console.error('❌ Error in refreshUserStatus:', error);
    console.error('❌ Error stack:', error.stack);
    await ctx.editMessageText('❌ <b>Произошла ошибка</b>\n\nПопробуй ещё раз позже.', { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Назад', 'refreshUserStatus')]]) });
  }
});
