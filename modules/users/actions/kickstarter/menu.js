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
    'Когда гоблинам нужно нечто особое, недоступное обычным смертным, они вступают в сделки. ' +
    'Запретные проекты, необычные коллекции, редкие ритуалы — всё это добывается здесь, в тени, по правилам Чернокнижника.\n\n' +
    '📜 <b>Твоя книга сделок:</b>\n' +
    `• Заключено сделок: <b>${purchasedKickstarters}</b>\n` +
    `• Свитков Кругов: <b>${totalScrolls}</b>\n\n` +
    '🕯 <b>О свитках:</b>\n' +
    'Свитки открывают дорогу к сделке и могут заменить оплату звёздами, если их сила достаточна.\n\n' +
    '💡 <b>Как это работает:</b>\n' +
    '• Сделка даёт доступ к проекту целиком\n' +
    '• Иногда демон приносит ранние материалы\n' +
    '• А порой — весь ритуальный набор, что выкупает орда\n\n' +
    '⚠️ <i>Не вступай в сделку, если не готов. Демоны терпят только тех, кто знает, чего хочет.</i>';
    
    

    const kickstarterKeyboard = [];
    
    // Primary actions - simplified to only show purchased and find new
    kickstarterKeyboard.push([
      Markup.button.callback('📚 Мои сделки', 'myKickstarters'),
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