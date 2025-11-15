const { Composer, Markup } = require("telegraf");
const { getUser } = require('../../../db/helpers');

module.exports = Composer.action('userKickstarters', async (ctx) => {
  try { await ctx.answerCbQuery(); } catch {}
  
  try {
    const userData = await getUser(ctx.from.id);
    if (!userData) {
      await ctx.editMessageText('❌ <b>Лицо не найдено в хрониках</b>\n\nДанные отсутствуют.', {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Назад', 'refreshUserStatus')]])
      });
      return;
    }

    const purchases = userData.purchases || {};
    const purchasedKickstarters = purchases.kickstarters?.length || 0;
    
    // Get scrolls from new system
    const { getUserScrolls } = require('../../../util/scrolls');
    const userScrolls = await getUserScrolls(ctx.from.id);
    const totalScrolls = userScrolls.reduce((total, scroll) => total + scroll.amount, 0);
    
    const kickstarterMessage = 
    '😈 <b>СДЕЛКИ С ДЕМОНАМИ</b>\n\n' +
    'Когда гоблины хотят заполучить нечто особое — они заключают сделки. ' +
    'Редкие кикстартеры, запретные коллекции, свежие релизы — всё это добывается здесь, в тени, по особым правилам.\n\n' +
    '📜 <b>Твоя книга сделок:</b>\n' +
    `• Заключено сделок: <b>${purchasedKickstarters}</b>\n` +
    `• Свитков для новых сделок: <b>${totalScrolls}</b>\n\n` +
    '🕯 <b>О свитках:</b>\n' +
    'Свитки можно использовать для покупки кикстартеров вместо звёзд.\n\n' +
    '💡 <b>Как это работает:</b>\n' +
    '• Сделки открывают доступ к уникальным проектам\n' +
    '• Некоторые приносят ранние файлы и материалы\n' +
    '• А иные — целые кикстартеры, выкупленные ордой\n\n' +
    '⚠️ <i>Не заключай сделку, если не готов. Демоны любят торговаться, но не прощают слабых.</i>';
    

    const kickstarterKeyboard = [];
    
    // Primary actions - simplified to only show purchased and find new
    kickstarterKeyboard.push([
      Markup.button.callback('📚 Мои кикстартеры', 'myKickstarters'),
      Markup.button.callback('🔍 Найти новые', 'browseKickstarters')
    ]);
    
    // Single back button
    kickstarterKeyboard.push([
      Markup.button.callback('🔙 Назад', 'refreshUserStatus')
    ]);

    await ctx.editMessageText(kickstarterMessage, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard(kickstarterKeyboard)
    });
    
  } catch (error) {
    console.error('Error in userKickstarters:', error);
    await ctx.editMessageText('❌ <b>Произошла ошибка</b>\n\nПопробуй ещё раз позже.', {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Назад', 'refreshUserStatus')]])
    });
  }
});