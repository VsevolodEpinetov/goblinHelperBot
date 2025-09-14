const { Composer, Markup } = require('telegraf');
const { getUser } = require('../../db/helpers');
const knex = require('../../db/knex');
const { logDenied } = require('../../util/logger');

module.exports = Composer.action('adminStarsBalance', async (ctx) => {
  try { 
    await ctx.answerCbQuery(); 
  } catch (cbError) {
    console.error('❌ answerCbQuery failed:', cbError.message);
  }
  
  try {
    // Check if user is super admin
    const adminUser = await getUser(ctx.from.id);
    
    if (!adminUser || !adminUser.roles || !adminUser.roles.includes('super')) {
      logDenied(ctx.from.id, ctx.from.username, 'adminStarsBalance', 'insufficient permissions');
      await ctx.editMessageText('❌ Недостаточно прав для просмотра баланса звёзд', {
        ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Назад', 'adminMenu')]])
      });
      return;
    }

    // Get stars balance using Telegram API
    const starsBalance = await ctx.telegram.getMyStarBalance();
    console.log('Stars Balance API Response:', starsBalance);

    // Get stars transactions using Telegram API
    const starsTransactions = await ctx.telegram.getStarTransactions();
    console.log('Stars Transactions API Response:', starsTransactions);

    const totalStars = starsBalance?.star_count || 0;
    const recentPayments = starsTransactions?.transactions || [];

    // Build message
    let starsMessage = `💫 <b>Баланс звёзд бота</b>\n\n`;
    starsMessage += `💰 <b>Общая выручка:</b> ${totalStars}⭐\n`;
    starsMessage += `📊 <b>Всего платежей:</b> ${recentPayments.length > 0 ? 'есть данные' : 'нет данных'}\n\n`;
    
    if (recentPayments.length > 0) {
      starsMessage += `📝 <b>Последние транзакции:</b>\n`;
      recentPayments.slice(0, 5).forEach((transaction, index) => {
        const date = new Date(transaction.date * 1000).toLocaleDateString('ru-RU');
        const amount = transaction.amount || 0;
        const type = transaction.source === 'user' ? 'Покупка' : 'Другое';
        starsMessage += `${index + 1}. ${amount}⭐ (${type}) - ${date}\n`;
      });
    } else {
      starsMessage += `📝 <b>Транзакции:</b> Данных пока нет\n`;
    }
    
    starsMessage += `\n💡 <b>Вывод:</b> @BotFather → Bot Settings → Payments → Withdraw Stars`;

    await ctx.editMessageText(starsMessage, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback('🔄 Обновить', 'adminStarsBalance'),
          Markup.button.callback('💸 Вывод', 'adminStarsWithdraw')
        ],
        [
          Markup.button.callback('🔙 Назад', 'adminMenu')
        ]
      ])
    });
    
  } catch (error) {
    console.error('❌ Error in adminStarsBalance:', error);
    
    try {
      await ctx.editMessageText(`❌ Ошибка получения баланса: ${error.message}`, {
        ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Назад', 'adminMenu')]])
      });
    } catch (fallbackError) {
      console.error('❌ Fallback failed:', fallbackError.message);
    }
  }
});
