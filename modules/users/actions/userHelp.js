const { Composer, Markup } = require("telegraf");
const { getUser } = require('../../db/helpers');

module.exports = Composer.action('userHelp', async (ctx) => {
  try { await ctx.answerCbQuery(); } catch {}
  
  try {
    const userData = await getUser(ctx.from.id);
    if (!userData) {
      await ctx.editMessageText('❌ <b>Лицо не найдено в хрониках</b>\n\nТвои данные исчезли в тумане. Попробуй снова позже.', { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback('🔙 В главное меню', 'refreshUserStatus')]]) });
      return;
    }

    const helpMessage = 
    '❓ <b>Помощь от гоблинов</b>\n\n' +
    'Запомни, новобранец: лучшая помощь — это сами гоблины.\n' +
    'Спроси в чате — и стая не оставит тебя без ответа.\n\n' +
    'А если совсем прижмёт — Главгоблин тоже знает пару слов.';
  

    const helpKeyboard = [
      [Markup.button.callback('🔙 В главное меню', 'refreshUserStatus')]
    ];

    await ctx.editMessageText(helpMessage, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard(helpKeyboard)
    });
    
  } catch (error) {
    console.error('Error in userHelp:', error);
    await ctx.editMessageText('❌ <b>Произошла ошибка</b>\n\nПопробуй ещё раз позже.', { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback('🔙 В главное меню', 'refreshUserStatus')]]) });
  }
});
