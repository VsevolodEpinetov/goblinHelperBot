const { Composer } = require('telegraf');
const { getUser } = require('../../db/helpers');
const knex = require('../../db/knex');

module.exports = Composer.command('stars_balance', async (ctx) => {
  // Check if user is super admin
  const adminUser = await getUser(ctx.from.id);
  if (!adminUser || !adminUser.roles || !adminUser.roles.includes('super')) {
    console.log(`❌ stars_balance rejected: user ${ctx.from.id} is not super admin`);
    return;
  }

  const userId = ctx.from.id;
  // Stars balance command from super admin

  try {
    // Get stars balance from database
    const completedPayments = await knex('paymentTracking')
      .where('status', 'completed')
      .select('amount', 'createdAt', 'subscriptionType', 'userId');
    
    const totalEarned = completedPayments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
    const recentTransactions = completedPayments
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5);
    
    let balanceMessage = `💫 <b>Bot Star Balance</b>\n\n`;
    
    if (completedPayments.length > 0) {
      balanceMessage += `💰 <b>Общая выручка:</b> ${totalEarned} ⭐\n`;
      balanceMessage += `📊 <b>Всего платежей:</b> ${completedPayments.length}\n\n`;
      
      if (recentTransactions.length > 0) {
        balanceMessage += `📝 <b>Последние транзакции:</b>\n`;
        recentTransactions.forEach((payment, index) => {
          const date = new Date(payment.createdAt).toLocaleString('ru-RU');
          const amount = payment.amount || 0;
          const type = payment.subscriptionType === 'plus' ? 'Плюс' : 'Обычная';
          balanceMessage += `${index + 1}. 💰 +${amount}⭐ (${type}) - ${date}\n`;
        });
      }
      
      // Add withdrawal information
      balanceMessage += `\n💡 <b>Как вывести звёзды:</b>\n`;
      balanceMessage += `1. Используй команду /stars_withdraw <amount>\n`;
      balanceMessage += `2. Или переведи через @BotFather → Bot Settings → Payments → Withdraw Stars\n`;
      balanceMessage += `3. Минимальная сумма вывода: 1000⭐\n`;
      balanceMessage += `4. Комиссия Telegram: ~3%\n\n`;
      balanceMessage += `💳 <b>Звёзды можно вывести на:</b>\n`;
      balanceMessage += `• TON Wallet\n`;
      balanceMessage += `• Другие поддерживаемые кошельки`;
      
    } else {
      balanceMessage += `❌ Нет данных о платежах\n`;
      balanceMessage += `💡 Платежи будут отображаться здесь после их обработки`;
    }

    await ctx.reply(balanceMessage, { parse_mode: 'HTML' });
    
  } catch (error) {
    console.error('❌ Error getting star balance:', error);
    
    let errorMessage = `❌ <b>Ошибка получения баланса</b>\n\n`;
    errorMessage += `Детали: ${error.message}\n\n`;
    errorMessage += `💡 <b>Возможные причины:</b>\n`;
    errorMessage += `• Проблема с подключением к базе данных\n`;
    errorMessage += `• Ошибка в запросе к таблице paymentTracking\n`;
    errorMessage += `• Временная недоступность сервиса\n\n`;
    errorMessage += `🔧 <b>Что делать:</b>\n`;
    errorMessage += `1. Попробуйте позже\n`;
    errorMessage += `2. Проверьте логи сервера\n`;
    errorMessage += `3. Обратитесь к администратору`;
    
    await ctx.reply(errorMessage, { parse_mode: 'HTML' });
  }
});
