const { Composer } = require('telegraf');
const knex = require('../../db/knex');
const SETTINGS = require('../../../settings.json');

module.exports = Composer.command('balance', async (ctx) => {
  // Simple authorization check
  const userId = ctx.from.id.toString();
  if (userId !== SETTINGS.CHATS.EPINETOV && userId !== SETTINGS.CHATS.GLAVGOBLIN) {
    console.log(`❌ balance rejected: user ${userId} not authorized`);
    return;
  }

  console.log(`✅ balance command from authorized user ${userId}`);

  try {
    // Get total earnings from completed payments
    const result = await knex('paymentTracking')
      .where('type', 'subscription')
      .where('status', 'completed')
      .where('currency', 'XTR')
      .sum('amount as total')
      .count('* as count')
      .first();

    const totalStars = parseInt(result?.total || 0);
    const totalPayments = parseInt(result?.count || 0);

    // Get recent payments
    const recentPayments = await knex('paymentTracking')
      .where('type', 'subscription')
      .where('status', 'completed')
      .select('subscriptionType', 'amount', 'completedAt', 'userId')
      .orderBy('completedAt', 'desc')
      .limit(5);

    // Get payment breakdown
    const breakdown = await knex('paymentTracking')
      .where('type', 'subscription')
      .where('status', 'completed')
      .where('currency', 'XTR')
      .select('subscriptionType')
      .sum('amount as total')
      .count('* as count')
      .groupBy('subscriptionType');

    let message = `💫 <b>Баланс звёзд бота</b>\n\n`;
    message += `💰 <b>Общий баланс:</b> ${totalStars}⭐\n`;
    message += `📊 <b>Всего платежей:</b> ${totalPayments}\n\n`;
    
    if (breakdown.length > 0) {
      message += `📈 <b>Разбивка по типам:</b>\n`;
      breakdown.forEach(item => {
        const type = item.subscriptionType === 'regular' ? 'Обычные' : 'Плюс';
        message += `• ${type}: ${item.count} платежей, ${item.total}⭐\n`;
      });
      message += `\n`;
    }

    if (recentPayments.length > 0) {
      message += `📝 <b>Последние платежи:</b>\n`;
      recentPayments.forEach((payment, index) => {
        const date = new Date(payment.completedAt).toLocaleDateString('ru-RU');
        const type = payment.subscriptionType === 'regular' ? 'Об' : 'Пл';
        message += `${index + 1}. User ${payment.userId}: ${payment.amount}⭐ (${type}) - ${date}\n`;
      });
      message += `\n`;
    }

    message += `💡 <b>Команды:</b>\n`;
    message += `• <code>/balance</code> - показать этот баланс\n`;
    message += `• <code>/withdraw &lt;сумма&gt;</code> - инструкция по выводу\n\n`;
    message += `🔧 <b>Вывод через @BotFather:</b>\n`;
    message += `Bot Settings → Payments → Withdraw Stars`;

    await ctx.replyWithHTML(message);
    console.log(`✅ Balance response sent to ${userId}`);

  } catch (error) {
    console.error('❌ Error in balance command:', error);
    await ctx.reply(`❌ Ошибка получения баланса: ${error.message}`);
  }
});
