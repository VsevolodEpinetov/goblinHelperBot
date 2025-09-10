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

    // Get payment statistics from database
    const totalEarnings = await knex('paymentTracking')
      .where('type', 'subscription')
      .where('status', 'completed')
      .where('currency', 'XTR')
      .sum('amount as total')
      .first();

    const totalStars = parseInt(totalEarnings?.total || 0);

    // Get recent payments
    const recentPayments = await knex('paymentTracking')
      .where('type', 'subscription')
      .where('status', 'completed')
      .select('subscriptionType', 'amount', 'completedAt')
      .orderBy('completedAt', 'desc')
      .limit(5);

    // Build message
    let starsMessage = `💫 <b>Баланс звёзд бота</b>\n\n`;
    starsMessage += `💰 <b>Общая выручка:</b> ${totalStars}⭐\n`;
    starsMessage += `📊 <b>Всего платежей:</b> ${recentPayments.length > 0 ? 'есть данные' : 'нет данных'}\n\n`;
    
    if (recentPayments.length > 0) {
      starsMessage += `📝 <b>Последние платежи:</b>\n`;
      recentPayments.forEach((payment, index) => {
        const date = new Date(payment.completedAt).toLocaleDateString('ru-RU');
        const type = payment.subscriptionType === 'regular' ? 'Об' : 'Пл';
        starsMessage += `${index + 1}. ${payment.amount}⭐ (${type}) - ${date}\n`;
      });
    } else {
      starsMessage += `📝 <b>Платежи:</b> Данных пока нет\n`;
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
