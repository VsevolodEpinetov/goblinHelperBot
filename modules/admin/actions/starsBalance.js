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

    // Get stars balance from database
    const completedPayments = await knex('paymentTracking')
      .where('status', 'completed')
      .select('amount', 'createdAt', 'subscriptionType', 'userId');
    
    const totalStars = completedPayments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
    const recentPayments = completedPayments
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 10);

    // Build message
    let starsMessage = `💫 <b>Баланс звёзд бота</b>\n\n`;
    starsMessage += `💰 <b>Общая выручка:</b> ${totalStars}⭐\n`;
    starsMessage += `📊 <b>Всего платежей:</b> ${completedPayments.length}\n\n`;
    
    if (recentPayments.length > 0) {
      starsMessage += `📝 <b>Последние транзакции:</b>\n`;
      recentPayments.slice(0, 5).forEach((payment, index) => {
        const date = new Date(payment.createdAt).toLocaleDateString('ru-RU');
        const amount = payment.amount || 0;
        const type = payment.subscriptionType === 'plus' ? 'Плюс' : 'Обычная';
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
